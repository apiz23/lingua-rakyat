"""
routers/chat.py - Question and answer endpoints.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from slowapi import Limiter

from routers.eval import _evaluator as evaluator
from utils import eligibility, idempotency
from utils.auth import get_supabase, get_verified_user
from utils.authorization import ANONYMOUS, Actor, ActorKind
from utils.chat_history import (
    delete_chat_messages,
    insert_chat_message,
    list_chat_messages,
    list_conversations,
    update_conversation_title,
)
from rate_limits import CHAT_LIMIT, get_proxy_aware_remote_address
from utils.rag_pipeline import answer_question, stream_answer_question

logger = logging.getLogger("chat_router")
limiter = Limiter(key_func=get_proxy_aware_remote_address)
router = APIRouter()
me_v1_router = APIRouter()


class AskRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str = ""
    document_name: str
    session_id: str = Field(min_length=1)
    question: str
    model_override: str = ""
    enable_query_augmentation: bool = True
    bypass_cache: bool = False
    # Last N Q&A turns for multi-turn context. Each: {"question": str, "answer": str}
    chat_history: list[dict] = Field(default_factory=list)
    # Optional multi-document scope. When non-empty, retrieval spans every doc
    # in this list (citizen asks across their whole library, no file picking).
    document_ids: list[str] = Field(default_factory=list)
    # Authenticated retries reuse this key so provider work is not repeated.
    idempotency_key: Optional[str] = Field(default=None, max_length=200)


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
    faithfulness: Optional[float] = None
    evidence_mode: str = "strong"
    confidence_explanation: Optional[str] = None
    # Additive, backward-compatible verification metadata. Absent on older
    # clients/history rows; never required to render an answer.
    verification: Optional[dict[str, Any]] = None


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
    faithfulness: Optional[float] = None


def _reject_spoofed_user_id(user_id: Optional[str], verified: Optional[str]) -> None:
    """A caller with no valid token cannot claim a Clerk user id (prefix `user_`) —
    Clerk ids aren't secret, so trusting them client-side would let anyone read or
    delete a signed-in account's merged history."""
    if not verified and user_id and user_id.startswith("user_"):
        raise HTTPException(status_code=401, detail="Sign in required for this account")


def _validate_ask_request(body: AskRequest) -> None:
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if len(body.question) > 1000:
        raise HTTPException(status_code=400, detail="Question is too long (max 1000 characters)")
    if not body.user_id.strip():
        raise HTTPException(status_code=400, detail="user_id cannot be empty")
    if not body.session_id.strip():
        raise HTTPException(status_code=400, detail="session_id cannot be empty")
    if not body.document_id.strip() and not [d for d in body.document_ids if d.strip()]:
        raise HTTPException(status_code=400, detail="Provide a document_id or document_ids")


def _actor_for(verified: Optional[str]) -> Actor:
    return Actor(ActorKind.CITIZEN, verified) if verified else ANONYMOUS


def _requested_document_ids(body: AskRequest) -> list[str]:
    ids: list[str] = []
    if body.document_id.strip():
        ids.append(body.document_id.strip())
    for document_id in body.document_ids:
        if document_id.strip() and document_id.strip() not in ids:
            ids.append(document_id.strip())
    return ids


def _authorize_ask_documents(verified: Optional[str], body: AskRequest) -> None:
    """Require public eligibility or verified ownership for every document."""
    ids = _requested_document_ids(body)
    try:
        rows, snapshot = eligibility.load_documents_for_authorization(
            get_supabase(admin=True), ids
        )
        eligibility.authorize_document_rows(
            _actor_for(verified), rows, snapshot, requested_ids=ids
        )
    except eligibility.EligibilityUnavailable as exc:
        logger.error("[Chat] Document eligibility unavailable: %s", exc)
        raise HTTPException(
            status_code=503, detail="Document service is temporarily unavailable."
        ) from exc


def _idempotency_fingerprint(body: AskRequest) -> dict[str, Any]:
    return {
        "question": body.question,
        "document_id": body.document_id,
        "document_name": body.document_name,
        "session_id": body.session_id,
        "model_override": body.model_override,
        "enable_query_augmentation": body.enable_query_augmentation,
        "bypass_cache": body.bypass_cache,
        "chat_history": body.chat_history,
        "document_ids": body.document_ids,
    }


def _claim_idempotent_run(verified: Optional[str], body: AskRequest):
    key = (body.idempotency_key or "").strip()
    if not key:
        return None
    if not verified:
        # Anonymous callers have no verified actor; a client-supplied key could
        # collide across devices and reveal another caller's answer.
        raise HTTPException(
            status_code=400, detail="idempotency_key requires a signed-in account"
        )
    fingerprint = idempotency.request_fingerprint(_idempotency_fingerprint(body))
    try:
        claim = idempotency.claim_run(
            get_supabase(admin=True),
            actor_id=verified,
            idempotency_key=key,
            fingerprint=fingerprint,
        )
    except idempotency.IdempotencyUnavailable as exc:
        logger.error("[Chat] Idempotency store unavailable: %s", exc)
        raise HTTPException(
            status_code=503, detail="Answer service is temporarily unavailable."
        ) from exc
    if claim.state == "conflict":
        raise HTTPException(
            status_code=409, detail="Idempotency key was already used for a different request"
        )
    if claim.state == "in_progress":
        raise HTTPException(status_code=409, detail="This request is already being processed")
    return claim


def _complete_idempotent_run(verified: Optional[str], body: AskRequest, response: dict) -> None:
    key = (body.idempotency_key or "").strip()
    if not key:
        return
    if not verified:
        return
    try:
        completed = idempotency.complete_run(
            get_supabase(admin=True),
            actor_id=verified,
            idempotency_key=key,
            response=response,
        )
    except idempotency.IdempotencyUnavailable as exc:
        logger.error("[Chat] Could not commit answer run: %s", exc)
        raise HTTPException(
            status_code=503, detail="Answer service is temporarily unavailable."
        ) from exc
    if not completed:
        raise HTTPException(status_code=503, detail="Answer service is temporarily unavailable.")


def _fail_idempotent_run(verified: Optional[str], body: AskRequest) -> None:
    key = (body.idempotency_key or "").strip()
    if not key or not verified:
        return
    try:
        idempotency.fail_run(
            get_supabase(admin=True), actor_id=verified, idempotency_key=key
        )
    except idempotency.IdempotencyUnavailable as exc:
        logger.error("[Chat] Could not mark answer run failed: %s", exc)


def _history_payload(body: AskRequest, result: dict[str, Any], timestamp: str, answer_text: str) -> dict[str, Any]:
    return {
        "user_id": body.user_id,
        "session_id": body.session_id,
        "document_id": body.document_id or result.get("document_id", ""),
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
        "faithfulness": result.get("faithfulness"),
        "created_at": timestamp,
    }


def _record_eval(body: AskRequest, result: dict[str, Any], answer_text: str) -> None:
    try:
        # Faithfulness is computed once in the RAG pipeline (_build_result) and
        # carried on the result, so we reuse it here instead of a second Cohere call.
        evaluator.record(
            question=body.question,
            answer=answer_text,
            language=result.get("language", "en"),
            confidence=result.get("confidence", 0.0),
            latency_ms=result.get("latency_ms", 0),
            document_id=body.document_id,
            faithfulness_score=result.get("faithfulness"),
        )
    except Exception as exc:
        logger.warning("[Eval] Failed to record interaction: %s", exc)


def clear_chat_history(
    document_id: str,
    *,
    verified_user_id: str,
    session_id: Optional[str] = None,
) -> int:
    return delete_chat_messages(
        document_id=document_id, user_id=verified_user_id, session_id=session_id
    )


@router.post("/ask", response_model=AskResponse)
@limiter.limit(CHAT_LIMIT)
async def ask_question(
    request: Request,
    body: AskRequest,
    verified: Optional[str] = Depends(get_verified_user),
):
    _ = request
    _reject_spoofed_user_id(body.user_id, verified)
    if verified:
        body.user_id = verified
    _validate_ask_request(body)
    _authorize_ask_documents(verified, body)
    claim = _claim_idempotent_run(verified, body)
    if claim is not None and claim.state == "replay" and claim.response is not None:
        return AskResponse(**claim.response)

    try:
        result = answer_question(
            question=body.question,
            document_id=body.document_id or None,
            model_override=body.model_override or None,
            enable_query_augmentation=body.enable_query_augmentation,
            bypass_cache=body.bypass_cache,
            chat_history=body.chat_history or None,
            document_ids=body.document_ids or None,
        )
    except Exception as exc:
        _fail_idempotent_run(verified, body)
        logger.error("[Chat] Q&A failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate answer. Please try again later.") from exc

    timestamp = datetime.utcnow().isoformat() + "Z"
    answer_text = result["answer"]
    # Public anonymous Q&A has no secure session capability, so do not persist
    # caller-supplied anonymous IDs or copy public prompts into evaluation data.
    if verified:
        if not insert_chat_message(_history_payload(body, result, timestamp, answer_text)):
            _fail_idempotent_run(verified, body)
            raise HTTPException(status_code=500, detail="Failed to save the answer.")
        _record_eval(body, result, answer_text)

    response = AskResponse(
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
        faithfulness=result.get("faithfulness"),
        evidence_mode=result.get("evidence_mode", "strong"),
        confidence_explanation=result.get("confidence_explanation"),
        verification=result.get("verification"),
    )
    _complete_idempotent_run(verified, body, response.model_dump(mode="json"))
    return response


@router.post("/ask-stream")
@limiter.limit(CHAT_LIMIT)
async def ask_question_stream(
    request: Request,
    body: AskRequest,
    verified: Optional[str] = Depends(get_verified_user),
):
    _ = request
    _reject_spoofed_user_id(body.user_id, verified)
    if verified:
        body.user_id = verified
    _validate_ask_request(body)
    _authorize_ask_documents(verified, body)
    claim = _claim_idempotent_run(verified, body)

    async def event_stream():
        timestamp = datetime.utcnow().isoformat() + "Z"
        answer_pieces: list[str] = []
        final_result: Optional[dict[str, Any]] = None

        yield f"data: {json.dumps({'type': 'start'})}\n\n"

        try:
            if claim is not None and claim.state == "replay" and claim.response is not None:
                yield f"data: {json.dumps({'type': 'complete', **claim.response})}\n\n"
                return

            for event in stream_answer_question(
                question=body.question,
                document_id=body.document_id or None,
                model_override=body.model_override or None,
                enable_query_augmentation=body.enable_query_augmentation,
                bypass_cache=body.bypass_cache,
                chat_history=body.chat_history or None,
                document_ids=body.document_ids or None,
            ):
                if event["type"] == "token":
                    answer_pieces.append(event["text"])
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "complete":
                    # Hold completion until persistence and idempotency commit
                    # succeed, so the client never sees a false success.
                    final_result = event
                else:
                    yield f"data: {json.dumps(event)}\n\n"

            if final_result is None:
                raise RuntimeError("Streaming finished without a completion event.")

            # The completion event is authoritative: verification may have
            # revised the answer after provisional tokens were streamed.
            answer_text = (final_result.get("answer") or "").strip() or "".join(
                answer_pieces
            ).strip()
            if verified:
                if not insert_chat_message(
                    _history_payload(body, final_result, timestamp, answer_text)
                ):
                    raise RuntimeError("History persistence failed.")
                _record_eval(body, final_result, answer_text)

            if claim is not None:
                _complete_idempotent_run(verified, body, final_result)

            yield f"data: {json.dumps(final_result)}\n\n"

        except HTTPException as exc:
            _fail_idempotent_run(verified, body)
            logger.error("[Chat] Streaming authorization failed: %s", exc.detail)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'An error occurred during generation.'})}\n\n"
        except Exception as exc:
            _fail_idempotent_run(verified, body)
            logger.error("[Chat] Streaming failed: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'An error occurred during generation.'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


class ConversationSummary(BaseModel):
    session_id: str
    title: str
    last_at: str
    count: int
    custom_title: Optional[str] = None


class RenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=80)


@router.get("/conversations", response_model=list[ConversationSummary])
async def get_conversations(
    user_id: str = "",
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    verified: Optional[str] = Depends(get_verified_user),
):
    # Anonymous IDs travel via header, not the query string — a query param
    # ends up in browser history, proxy/access logs, and Referer headers;
    # a header does not. Query param kept only as a deprecated fallback.
    if not verified or not verified.strip():
        raise HTTPException(status_code=401, detail="Sign-in required to access chat history")
    supplied_user_id = x_user_id if x_user_id is not None else user_id
    if supplied_user_id and supplied_user_id != verified:
        raise HTTPException(status_code=403, detail="Not authorized to access this history")
    return list_conversations(verified)


@router.patch("/conversations/{session_id}")
async def rename_conversation(
    session_id: str,
    body: RenameRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    verified: Optional[str] = Depends(get_verified_user),
):
    if not verified or not verified.strip():
        raise HTTPException(status_code=401, detail="Sign-in required to change chat history")
    if x_user_id is not None and x_user_id != verified:
        raise HTTPException(status_code=403, detail="Not authorized to change this history")
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="Invalid conversation")
    ok = update_conversation_title(verified, session_id, body.title.strip())
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True, "session_id": session_id, "title": body.title.strip()}


@router.get("/history", response_model=list[ChatMessage])
async def get_chat_history(
    document_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    verified: Optional[str] = Depends(get_verified_user),
):
    # See get_conversations above — header preferred over query string.
    if not verified or not verified.strip():
        raise HTTPException(status_code=401, detail="Sign-in required to access chat history")
    supplied_user_id = x_user_id if x_user_id is not None else user_id
    if supplied_user_id and supplied_user_id != verified:
        raise HTTPException(status_code=403, detail="Not authorized to access this history")
    if document_id is not None and not document_id.strip():
        raise HTTPException(status_code=400, detail="Invalid history scope")
    if session_id is not None and not session_id.strip():
        raise HTTPException(status_code=400, detail="Invalid conversation")
    try:
        rows = list_chat_messages(document_id=document_id, session_id=session_id, user_id=verified)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid history scope") from exc
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
            faithfulness=row.get("faithfulness"),
        ))
    return messages


@router.delete("/history/{document_id}")
async def clear_document_chat_history(
    document_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    verified: Optional[str] = Depends(get_verified_user),
):
    if not verified or not verified.strip():
        raise HTTPException(status_code=401, detail="Sign-in required to delete chat history")
    if user_id is not None and user_id != verified:
        raise HTTPException(status_code=403, detail="Not authorized to delete this history")
    if not document_id.strip() or (session_id is not None and not session_id.strip()):
        raise HTTPException(status_code=400, detail="Invalid history scope")
    try:
        deleted = clear_chat_history(
            document_id, verified_user_id=verified, session_id=session_id
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail="Failed to clear chat history") from exc
    return {
        "success": True,
        "message": "Chat history cleared",
        "deleted_rows": deleted,
    }


# Versioned authenticated-citizen adapters. They intentionally omit caller
# owner IDs from their schemas and delegate to the established Clerk-checked
# handlers. History remains document-scoped; there is no unscoped list/delete.
@me_v1_router.get("/conversations", response_model=list[ConversationSummary])
async def get_my_conversations_v1(
    verified: Optional[str] = Depends(get_verified_user),
):
    return await get_conversations(user_id="", x_user_id=None, verified=verified)


@me_v1_router.patch("/conversations/{session_id}")
async def rename_my_conversation_v1(
    session_id: str,
    body: RenameRequest,
    verified: Optional[str] = Depends(get_verified_user),
):
    return await rename_conversation(
        session_id=session_id,
        body=body,
        x_user_id=None,
        verified=verified,
    )


@me_v1_router.get("/history", response_model=list[ChatMessage])
async def get_my_history_v1(
    document_ref: str,
    conversation_ref: Optional[str] = None,
    verified: Optional[str] = Depends(get_verified_user),
):
    if not document_ref.strip():
        raise HTTPException(status_code=400, detail="Invalid history scope")
    return await get_chat_history(
        document_id=document_ref,
        session_id=conversation_ref,
        user_id=None,
        x_user_id=None,
        verified=verified,
    )


@me_v1_router.delete("/history")
async def delete_my_history_v1(
    document_ref: str,
    conversation_ref: Optional[str] = None,
    verified: Optional[str] = Depends(get_verified_user),
):
    if not document_ref.strip():
        raise HTTPException(status_code=400, detail="Invalid history scope")
    return await clear_document_chat_history(
        document_id=document_ref,
        user_id=None,
        session_id=conversation_ref,
        verified=verified,
    )
