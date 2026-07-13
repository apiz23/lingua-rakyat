"""routers/share.py — create and retrieve shared answer links."""
import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from utils.auth import get_verified_user
from utils.shared_answers import delete_share, get_share, list_shares_for_user, store_share

logger = logging.getLogger("share_router")
router = APIRouter()


class ShareRequest(BaseModel):
    question: str
    answer: str
    sources: list[dict] = []
    language: str = "ms"
    confidence: float = 0.0
    confidence_label: str = ""
    agency: str = ""


class ShareResponse(BaseModel):
    slug: str
    url: str


class SharedAnswerResponse(BaseModel):
    slug: str
    question: str
    answer: str
    sources: list[dict]
    language: str
    created_at: str
    confidence: float = 0.0
    confidence_label: str = ""
    agency: str = ""


@router.post("", response_model=ShareResponse)
async def create_share(body: ShareRequest, verified: Optional[str] = Depends(get_verified_user)):
    if not body.question.strip() or not body.answer.strip():
        raise HTTPException(status_code=400, detail="question and answer are required")
    try:
        slug = store_share(
            question=body.question,
            answer=body.answer,
            sources=body.sources,
            language=body.language,
            confidence=body.confidence,
            confidence_label=body.confidence_label,
            agency=body.agency,
            user_id=verified,
        )
    except Exception as exc:
        logger.error("[Share] Failed to store: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create share link") from exc
    return ShareResponse(slug=slug, url=f"/share/{slug}")


class MyShareItem(BaseModel):
    slug: str
    question: str
    confidence_label: str = ""
    agency: str = ""
    created_at: str = ""


@router.get("/mine", response_model=list[MyShareItem])
def my_shares(verified: Optional[str] = Depends(get_verified_user)):
    if not verified:
        raise HTTPException(status_code=401, detail="Sign-in required")
    rows = list_shares_for_user(verified)
    return [
        MyShareItem(
            slug=row["slug"],
            question=row.get("question", ""),
            confidence_label=row.get("confidence_label", "") or "",
            agency=row.get("agency", "") or "",
            created_at=row.get("created_at", "") or "",
        )
        for row in rows
    ]


@router.get("/{slug}", response_model=SharedAnswerResponse)
async def fetch_share(slug: str):
    result = get_share(slug)
    if result is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    return SharedAnswerResponse(
        slug=result["slug"],
        question=result["question"],
        answer=result["answer"],
        sources=result.get("sources", []),
        language=result.get("language", "ms"),
        created_at=result.get("created_at", ""),
        confidence=float(result.get("confidence", 0.0) or 0.0),
        confidence_label=result.get("confidence_label", "") or "",
        agency=result.get("agency", "") or "",
    )


@router.delete("/{slug}")
def revoke_share(slug: str, verified: Optional[str] = Depends(get_verified_user)):
    if not verified:
        raise HTTPException(status_code=401, detail="Sign-in required")
    row = get_share(slug)
    if row is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    if not row.get("user_id") or row["user_id"] != verified:
        # Anonymous/legacy shares have no owner and can never be revoked.
        raise HTTPException(status_code=403, detail="Not your share")
    delete_share(slug)
    logger.info("[Share] %s revoked slug=%s", verified, slug)
    return {"success": True}
