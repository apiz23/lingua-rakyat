import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from utils.auth import get_supabase

logger = logging.getLogger("feedback_router")
router = APIRouter()


class FeedbackRequest(BaseModel):
    session_id: str
    question: str
    doc_id: str
    feedback: Literal["up", "down"]


@router.post("")
async def submit_feedback(body: FeedbackRequest):
    try:
        get_supabase().table("lr_feedback").insert({
            "session_id": body.session_id,
            "question": body.question,
            "doc_id": body.doc_id,
            "feedback": body.feedback,
        }).execute()
    except Exception as exc:
        logger.warning("[Feedback] DB insert failed: %s", exc)
    return {"ok": True}
