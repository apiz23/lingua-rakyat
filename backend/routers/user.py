"""routers/user.py — account actions: merge anonymous history into a signed-in account."""
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.auth import get_supabase, get_verified_user

logger = logging.getLogger("user_router")
router = APIRouter()

CHAT_TABLE = os.getenv("CHAT_HISTORY_TABLE", "lr_chat_messages")
SHARE_TABLE = "lr_shared_answers"


class MergeRequest(BaseModel):
    anon_user_id: str = Field(min_length=1)


class MergeResponse(BaseModel):
    chat_rows: int
    share_rows: int


@router.post("/merge-anon", response_model=MergeResponse)
def merge_anon(body: MergeRequest, verified: Optional[str] = Depends(get_verified_user)):
    if not verified:
        raise HTTPException(status_code=401, detail="Sign-in required")
    anon = body.anon_user_id.strip()
    if not anon or anon.startswith("user_"):
        raise HTTPException(status_code=400, detail="anon_user_id must be an anonymous ID")

    client = get_supabase(admin=True)
    res = client.table(CHAT_TABLE).update({"user_id": verified}).eq("user_id", anon).execute()
    chat_rows = len(res.data or [])

    share_rows = 0
    try:
        res = client.table(SHARE_TABLE).update({"user_id": verified}).eq("user_id", anon).execute()
        share_rows = len(res.data or [])
    except Exception as exc:
        # Pre-migration tolerance: lr_shared_answers.user_id may not exist yet.
        logger.warning("[Merge] share-table update skipped: %s", exc)

    logger.info("[Merge] %s adopted %d chat rows, %d shares from %s", verified, chat_rows, share_rows, anon)
    return MergeResponse(chat_rows=chat_rows, share_rows=share_rows)
