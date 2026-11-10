"""routers/user.py — account actions: merge anonymous history into a signed-in account."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.auth import get_verified_user

router = APIRouter()


class MergeRequest(BaseModel):
    anon_user_id: str = Field(min_length=1)


@router.post("/merge-anon")
def merge_anon(body: MergeRequest, verified: Optional[str] = Depends(get_verified_user)):
    if not verified:
        raise HTTPException(status_code=401, detail="Sign-in required")



    _ = body
    raise HTTPException(status_code=503, detail="Anonymous history linking is temporarily unavailable.")
