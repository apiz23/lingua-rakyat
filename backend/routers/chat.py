"""
routers/chat.py — Question & Answer Endpoints
==============================================
This file defines the API endpoints for:
  POST /api/chat/ask       — Ask a question about a document
  GET  /api/chat/history   — Get past Q&A pairs for a document

The actual AI logic lives in utils/rag_pipeline.py.
This file just handles the HTTP layer (receiving requests, returning responses).
"""

import json
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.rag_pipeline import answer_question

router = APIRouter()

# ─── Simple File-Based Chat History Store ────────────────────────────────────
# For a hackathon, we store chat history in a JSON file.
# In production you would use a proper database.

CHAT_HISTORY_FILE = "./documents/chat_history.json"

def load_chat_history() -> list[dict]:
    if not os.path.exists(CHAT_HISTORY_FILE):
        return []
    with open(CHAT_HISTORY_FILE, "r") as f:
        return json.load(f)

def save_chat_history(history: list[dict]) -> None:
    os.makedirs(os.path.dirname(CHAT_HISTORY_FILE), exist_ok=True)
    with open(CHAT_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, default=str)


# ─── Request / Response Models ────────────────────────────────────────────────

class AskRequest(BaseModel):
    """
    The body of a POST /api/chat/ask request.
    
    Example JSON body:
        {
            "document_id": "a1b2c3d4-...",
            "document_name": "housing_policy.pdf",
            "question": "What are the eligibility criteria?"
        }
    """
    document_id: str
    document_name: str
    question: str


class SourceChunk(BaseModel):
    text: str
    document_id: str
    score: float


class AskResponse(BaseModel):
    """
    The response from POST /api/chat/ask.
    
    Example JSON response:
        {
            "answer": "The eligibility criteria include...",
            "sources": [
                {"content": "Eligibility criteria include...", "chunk_index": 3},
                ...
            ],
            "language": "en",
            "question": "What are the eligibility criteria?",
            "timestamp": "2024-01-15T10:30:00"
        }
    """
    answer: str
    sources: list[SourceChunk]
    language: str
    question: str
    timestamp: str


class ChatMessage(BaseModel):
    id: str
    document_id: str
    question: str
    answer: str
    language: str
    sources: list[SourceChunk]
    timestamp: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    """
    Ask a question about an uploaded document.
    
    This endpoint:
    1. Validates the request
    2. Calls answer_question() from rag_pipeline.py
    3. Saves the Q&A pair to chat history
    4. Returns the answer + source excerpts
    
    The frontend sends a JSON body with the document_id and question.
    Example (JavaScript fetch):
        const response = await fetch("/api/chat/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                document_id: "a1b2c3d4-...",
                document_name: "housing_policy.pdf",
                question: "What are the eligibility criteria?"
            })
        });
        const data = await response.json();
        console.log(data.answer);  // The AI's answer
        console.log(data.sources); // The document excerpts used
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    if len(request.question) > 1000:
        raise HTTPException(status_code=400, detail="Question is too long (max 1000 characters)")
    
    # ── Run the RAG pipeline ─────────────────────────────────────────────────
    try:
        result = answer_question(
            question=request.question,
            document_id=request.document_id,
        )
    except Exception as e:
        error_msg = str(e)
        print(f"[Chat] Q&A failed: {error_msg}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer: {error_msg}"
        )
    
    timestamp = datetime.now().isoformat()
    
    # ── Save to chat history ─────────────────────────────────────────────────
    import uuid
    history_entry = {
        "id": str(uuid.uuid4()),
        "document_id": request.document_id,
        "question": request.question,
        "answer": result["answer"],
        "language": result["language"],
        "sources": result["sources"],
        "timestamp": timestamp,
    }
    
    history = load_chat_history()
    history.append(history_entry)
    save_chat_history(history)
    
    return AskResponse(
        answer=result["answer"],
        sources=[SourceChunk(**s) for s in result["sources"]],
        language=result["language"],
        question=request.question,
        timestamp=timestamp,
    )


@router.get("/history", response_model=list[ChatMessage])
async def get_chat_history(document_id: Optional[str] = None):
    """
    Get past Q&A pairs, optionally filtered by document.
    
    Args:
        document_id: (Optional query param) Filter history for one document.
                     If not provided, returns all history.
    
    Example URL:
        GET /api/chat/history?document_id=a1b2c3d4-...
    """
    history = load_chat_history()
    
    if document_id:
        history = [h for h in history if h["document_id"] == document_id]
    
    # Return most recent first
    history.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return [ChatMessage(**h) for h in history]


@router.delete("/history/{document_id}")
async def clear_chat_history(document_id: str):
    """
    Clear all chat history for a specific document.
    Called when the user deletes a document.
    """
    history = load_chat_history()
    history = [h for h in history if h["document_id"] != document_id]
    save_chat_history(history)
    return {"success": True, "message": "Chat history cleared"}
