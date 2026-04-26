"""
routers/chat.py - Question and answer endpoints.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from routers.eval import _evaluator as evaluator
from utils.chat_history import (
    delete_chat_messages,
    delete_chat_messages_for_document,
    insert_chat_message,
    list_chat_messages,
)
from utils.rag_pipeline import answer_question, stream_answer_question

logger = logging.getLogger("chat_router")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


class AskRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str
    document_name: str
    session_id: str = Field(min_length=1)
    question: str
    model_override: str = ""
    enable_query_augmentation: bool = True


class SourceChunk(BaseModel):
    text: str
    document_id: str
    score: float
    doc_name: str = ""
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    section_title: str = ""
    vector_score: float = 0.0
    rerank_score: float = 0.0
    confidence_label: str = "low"


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    language: str
    question: str
    timestamp: str
    confidence: float = 0.0
    confidence_label: str = "low"
    latency_ms: int = 0
    model_used: str = ""
    retrieval_mode: str = "single_query"
    query_variants_used: list[str] = Field(default_factory=list)
    top_query_variant: str = ""
    sufficient_evidence: bool = True


class ChatMessage(BaseModel):
    id: str
    user_id: str = ""
    session_id: str
    document_id: str
    question: str
    answer: str
    language: str
    sources: list[SourceChunk]
    timestamp: str
    confidence: float = 0.0
    confidence_label: str = "low"
    latency_ms: int = 0
    model_used: str = ""
    sufficient_evidence: bool = True


def _validate_ask_request(body: AskRequest) -> None:
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if len(body.question) > 1000:
        raise HTTPException(status_code=400, detail="Question is too long (max 1000 characters)")
    if not body.user_id.strip():
        raise HTTPException(status_code=400, detail="user_id cannot be empty")
    if not body.session_id.strip():
        raise HTTPException(status_code=400, detail="session_id cannot be empty")


def _history_payload(body: AskRequest, result: dict[str, Any], timestamp: str, answer_text: str) -> dict[str, Any]:
    return {
        "user_id": body.user_id,
        "session_id": body.session_id,
        "document_id": body.document_id,
        "document_name": body.document_name,
        "question": body.question,
        "answer": answer_text,
        "language": result.get("language", "en"),
        "sources": result.get("sources", []),
        "confidence": result.get("confidence", 0.0),
        "confidence_label": result.get("confidence_label", "low"),
        "latency_ms": result.get("latency_ms", 0),
        "model_used": result.get("model_used", ""),
        "sufficient_evidence": result.get("sufficient_evidence", True),
        "created_at": timestamp,
    }


def _record_eval(body: AskRequest, result: dict[str, Any], answer_text: str) -> None:
    try:
        evaluator.record(
            question=body.question,
            answer=answer_text,
            language=result.get("language", "en"),
            confidence=result.get("confidence", 0.0),
            latency_ms=result.get("latency_ms", 0),
            document_id=body.document_id,
        )
    except Exception as exc:
        logger.warning("[Eval] Failed to record interaction: %s", exc)


def clear_chat_history(
    document_id: str,
    *,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> int:
    if user_id or session_id:
        return delete_chat_messages(document_id=document_id, user_id=user_id, session_id=session_id)
    return delete_chat_messages_for_document(document_id)


@router.post("/ask", response_model=AskResponse)
@limiter.limit("30/minute")
async def ask_question(request: Request, body: AskRequest):
    _ = request
    _validate_ask_request(body)

    try:
        result = answer_question(
            question=body.question,
            document_id=body.document_id,
            model_override=body.model_override or None,
            enable_query_augmentation=body.enable_query_augmentation,
        )
    except Exception as exc:
        logger.error("[Chat] Q&A failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {exc}") from exc

    timestamp = datetime.utcnow().isoformat() + "Z"
    answer_text = result["answer"]
    insert_chat_message(_history_payload(body, result, timestamp, answer_text))
    _record_eval(body, result, answer_text)

    return AskResponse(
        answer=answer_text,
        sources=[SourceChunk(**source) for source in result["sources"]],
        language=result["language"],
        question=body.question,
        timestamp=timestamp,
        confidence=result.get("confidence", 0.0),
        confidence_label=result.get("confidence_label", "low"),
        latency_ms=result.get("latency_ms", 0),
        model_used=result.get("model_used", ""),
        retrieval_mode=result.get("retrieval_mode", "single_query"),
        query_variants_used=result.get("query_variants_used", []),
        top_query_variant=result.get("top_query_variant", ""),
        sufficient_evidence=result.get("sufficient_evidence", True),
    )


@router.post("/ask-stream")
@limiter.limit("30/minute")
async def ask_question_stream(request: Request, body: AskRequest):
    _ = request
    _validate_ask_request(body)

    async def event_stream():
        timestamp = datetime.utcnow().isoformat() + "Z"
        answer_pieces: list[str] = []
        final_result: Optional[dict[str, Any]] = None

        yield f"data: {json.dumps({'type': 'start'})}\n\n"

        try:
            for event in stream_answer_question(
                question=body.question,
                document_id=body.document_id,
                model_override=body.model_override or None,
                enable_query_augmentation=body.enable_query_augmentation,
            ):
                if event["type"] == "token":
                    answer_pieces.append(event["text"])
                elif event["type"] == "complete":
                    final_result = event

                yield f"data: {json.dumps(event)}\n\n"

            if final_result is None:
                raise RuntimeError("Streaming finished without a completion event.")

            answer_text = "".join(answer_pieces).strip() or final_result.get("answer", "")
            insert_chat_message(_history_payload(body, final_result, timestamp, answer_text))
            _record_eval(body, final_result, answer_text)

        except Exception as exc:
            logger.error("[Chat] Streaming failed: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history", response_model=list[ChatMessage])
async def get_chat_history(
    document_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
):
    rows = list_chat_messages(document_id=document_id, session_id=session_id, user_id=user_id)
    messages = []
    for row in rows:
        messages.append(ChatMessage(
            id=str(row.get("id", uuid.uuid4())),
            user_id=row.get("user_id", ""),
            session_id=row.get("session_id", ""),
            document_id=row.get("document_id", ""),
            question=row.get("question", ""),
            answer=row.get("answer", ""),
            language=row.get("language", "en"),
            sources=[SourceChunk(**source) for source in row.get("sources", [])],
            timestamp=row.get("created_at", ""),
            confidence=float(row.get("confidence", 0.0) or 0.0),
            confidence_label=row.get("confidence_label", "low"),
            latency_ms=int(row.get("latency_ms", 0) or 0),
            model_used=row.get("model_used", ""),
            sufficient_evidence=bool(row.get("sufficient_evidence", True)),
        ))
    return messages


@router.delete("/history/{document_id}")
async def clear_document_chat_history(
    document_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
):
    deleted = clear_chat_history(document_id, user_id=user_id, session_id=session_id)
    return {
        "success": True,
        "message": "Chat history cleared",
        "deleted_rows": deleted,
    }
