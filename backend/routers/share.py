"""routers/share.py — create and retrieve shared answer links."""
import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from utils.auth import get_supabase, get_verified_user
from utils import eligibility
from utils.shared_answers import (
    delete_share,
    find_owned_chat_answer,
    get_share,
    list_shares_for_user,
    store_share,
)

logger = logging.getLogger("share_router")
router = APIRouter()
public_v1_router = APIRouter()
me_v1_router = APIRouter()


def _eligible_share_sources(sources: list[dict]) -> Optional[list[dict]]:
    """Return only citations whose current revisions are publicly eligible.

    Returns ``None`` when any cited document is missing or ineligible, so the
    caller suppresses the whole share instead of exposing stale evidence.
    Sources without a document id are dropped because they cannot be
    revalidated.
    """
    cited_ids = []
    for source in sources:
        document_id = source.get("document_id") if isinstance(source, dict) else None
        if isinstance(document_id, str) and document_id.strip():
            if document_id.strip() not in cited_ids:
                cited_ids.append(document_id.strip())
    if not cited_ids:

        return []

    try:
        rows, snapshot = eligibility.load_documents_for_authorization(
            get_supabase(admin=True), cited_ids
        )
    except eligibility.EligibilityUnavailable as exc:
        logger.error("[Share] Eligibility unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Share service unavailable") from exc

    for document_id in cited_ids:
        row = rows.get(document_id)
        if row is None or not eligibility.is_document_public(row, snapshot):
            return None

    return [
        source
        for source in sources
        if isinstance(source, dict)
        and isinstance(source.get("document_id"), str)
        and source.get("document_id", "").strip() in cited_ids
    ]


class ShareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")



    session_id: Optional[str] = Field(default=None, min_length=1)
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    sources: list[dict] = Field(default_factory=list)
    language: Optional[str] = None
    confidence: Optional[float] = None
    confidence_label: Optional[str] = None
    agency: Optional[str] = None


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
    evidence_linked: bool = False


@router.post("", response_model=ShareResponse)
async def create_share(body: ShareRequest, verified: Optional[str] = Depends(get_verified_user)):
    if not verified or not verified.strip():
        raise HTTPException(status_code=401, detail="Sign in to create a share link")
    try:
        persisted = find_owned_chat_answer(
            user_id=verified,
            session_id=body.session_id,
            question=body.question,
            answer=body.answer,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid share request") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Share service unavailable") from exc
    if persisted is None:
        raise HTTPException(status_code=404, detail="Saved answer not found")

    sources = persisted.get("sources") or []
    if not isinstance(sources, list):
        sources = []
    try:
        slug = store_share(
            question=persisted["question"],
            answer=persisted["answer"],
            sources=sources,
            language=persisted.get("language") or "ms",
            confidence=float(persisted.get("confidence") or 0.0),
            confidence_label="",
            agency="",
            user_id=verified,
        )
    except Exception as exc:
        logger.error("[Share] Store operation failed")
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
async def fetch_share(slug: str, response: Response):
    response.headers["Cache-Control"] = "no-store, private"
    result = get_share(slug)
    if result is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    persisted = None
    if result.get("user_id"):
        try:
            persisted = find_owned_chat_answer(
                user_id=result["user_id"],
                question=result.get("question", ""),
                answer=result.get("answer", ""),
            )
        except ValueError:

            persisted = None
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail="Share service unavailable") from exc
    sources = persisted.get("sources") if persisted else []
    if not isinstance(sources, list):
        sources = []
    sources = _eligible_share_sources(sources)
    if sources is None:


        raise HTTPException(status_code=404, detail="Share link not found")
    return SharedAnswerResponse(
        slug=result["slug"],
        question=result["question"],
        answer=result["answer"],
        sources=sources,
        language=(persisted.get("language") if persisted else result.get("language")) or "ms",
        created_at=result.get("created_at", ""),
        confidence=float(persisted.get("confidence", 0.0) or 0.0) if persisted else 0.0,
        confidence_label="",
        agency="",
        evidence_linked=bool(persisted is not None and sources),
    )


@router.delete("/{slug}")
def revoke_share(slug: str, verified: Optional[str] = Depends(get_verified_user)):
    if not verified:
        raise HTTPException(status_code=401, detail="Sign-in required")
    row = get_share(slug)
    if row is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    if not row.get("user_id") or row["user_id"] != verified:

        raise HTTPException(status_code=403, detail="Not your share")
    try:
        deleted = delete_share(slug, user_id=verified)
    except Exception as exc:
        logger.error("[Share] Revocation operation failed")
        raise HTTPException(status_code=500, detail="Failed to revoke share") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Share link not found")
    logger.info("[Share] Owner revoked a share slug=%s", slug)
    return {"success": True}



@public_v1_router.get("/{slug}", response_model=SharedAnswerResponse)
async def fetch_public_share_v1(slug: str, response: Response):
    return await fetch_share(slug, response)


@me_v1_router.get("/shares", response_model=list[MyShareItem])
def list_my_shares_v1(verified: Optional[str] = Depends(get_verified_user)):
    return my_shares(verified)


@me_v1_router.post("/shares", response_model=ShareResponse)
async def create_my_share_v1(
    body: ShareRequest,
    verified: Optional[str] = Depends(get_verified_user),
):




    return await create_share(body, verified)


@me_v1_router.delete("/shares/{slug}")
def revoke_my_share_v1(slug: str, verified: Optional[str] = Depends(get_verified_user)):
    return revoke_share(slug, verified)
