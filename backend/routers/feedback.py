import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter

from rate_limits import FEEDBACK_LIMIT, get_proxy_aware_remote_address
from utils.auth import get_supabase

logger = logging.getLogger("feedback_router")
limiter = Limiter(key_func=get_proxy_aware_remote_address)
router = APIRouter()
public_v1_router = APIRouter()


class FeedbackRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    question: str = Field(min_length=1, max_length=1000)
    doc_id: str = Field(max_length=128)
    feedback: Literal["up", "down"]


@router.post("")
@limiter.limit(FEEDBACK_LIMIT)
def submit_feedback(request: Request, body: FeedbackRequest):
    _ = request
    try:
        get_supabase(admin=True).table("lr_feedback").insert({
            "session_id": body.session_id,
            "question": body.question,
            "doc_id": body.doc_id,
            "feedback": body.feedback,
        }).execute()
    except Exception as exc:
        _ = exc
        logger.warning("[Feedback] DB insert failed")
        raise HTTPException(status_code=503, detail="Feedback service unavailable") from exc
    return {"ok": True}


public_v1_router.add_api_route(
    "/feedback",
    submit_feedback,
    methods=["POST"],
    name="submit_public_feedback_v1",
)
