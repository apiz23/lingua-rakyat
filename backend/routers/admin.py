"""Admin API (v1). Every route is privileged and fail-closed."""

from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from utils import admin_service
from utils.authorization import Actor, require_permission
from utils.publication_store import documents_table

logger = logging.getLogger("admin_router")
router = APIRouter()

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
PDF_MAGIC = b"%PDF-"


def _actor(permission: str):
    return Depends(require_permission(permission))


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except admin_service.AdminValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except admin_service.AdminNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except admin_service.AdminConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except admin_service.AdminUnavailable as exc:
        logger.error("[Admin] Unavailable: %s", exc)
        raise HTTPException(
            status_code=503, detail="Admin service is temporarily unavailable."
        ) from exc


def _client():
    from utils.auth import get_supabase

    return get_supabase(admin=True)


class MetadataUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    agency: Optional[str] = Field(default=None, max_length=120)
    is_featured: Optional[bool] = None
    expires_at: Optional[str] = None
    source_id: Optional[str] = Field(default=None, max_length=120)


class SourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: str = Field(min_length=1, max_length=120)
    issuing_organization: str = Field(min_length=1, max_length=200)
    source_type: str = Field(min_length=1, max_length=80)
    authority: Optional[str] = Field(default=None, max_length=200)
    source_url: Optional[str] = Field(default=None, max_length=2000)
    usage_rights: Optional[str] = Field(default=None, max_length=500)
    freshness_days: Optional[int] = Field(default=None, gt=0, le=3650)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    issuing_organization: Optional[str] = Field(default=None, min_length=1, max_length=200)
    authority: Optional[str] = Field(default=None, max_length=200)
    source_url: Optional[str] = Field(default=None, max_length=2000)
    source_type: Optional[str] = Field(default=None, min_length=1, max_length=80)
    usage_rights: Optional[str] = Field(default=None, max_length=500)
    usage_permitted: Optional[bool] = None
    freshness_days: Optional[int] = Field(default=None, gt=0, le=3650)
    metadata: Optional[dict[str, Any]] = None


class SourceVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")
    evidence: str = Field(min_length=1, max_length=4000)
    freshness_days: int = Field(gt=0, le=3650)
    usage_rights: str = Field(min_length=1, max_length=500)
    usage_permitted: bool = True


class ReasonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Optional[str] = Field(default=None, max_length=2000)


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str
    reason: Optional[str] = Field(default=None, max_length=2000)


class RoleGrant(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_actor_id: str = Field(min_length=1, max_length=200)
    role: str
    reason: Optional[str] = Field(default=None, max_length=2000)


class RoleRevoke(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_actor_id: str = Field(min_length=1, max_length=200)
    role: str
    reason: str = Field(min_length=1, max_length=2000)


@router.get("/dashboard")
def dashboard(actor: Actor = _actor("admin.dashboard.read")):
    return _run(admin_service.dashboard, _client(), actor)


@router.get("/documents")
def list_documents(
    q: Optional[str] = None,
    processing_status: Optional[str] = None,
    visibility: Optional[str] = None,
    publication_status: Optional[str] = None,
    source_id: Optional[str] = None,
    uploaded_from: Optional[str] = None,
    uploaded_to: Optional[str] = None,
    sort: str = "uploaded_at",
    order: str = "desc",
    page: int = 1,
    page_size: int = 25,
    actor: Actor = _actor("admin.documents.read"),
):
    return _run(
        admin_service.list_documents,
        _client(),
        actor,
        query=q,
        processing_status=processing_status,
        visibility=visibility,
        publication_status=publication_status,
        source_id=source_id,
        uploaded_from=uploaded_from,
        uploaded_to=uploaded_to,
        sort=sort,
        order=order,
        page=page,
        page_size=page_size,
    )


@router.get("/documents/{document_id}")
def get_document(document_id: str, actor: Actor = _actor("admin.documents.read")):
    return _run(admin_service.get_document, _client(), actor, document_id)


@router.patch("/documents/{document_id}")
def update_document(
    document_id: str,
    body: MetadataUpdate,
    actor: Actor = _actor("admin.documents.write"),
):
    updates = body.model_dump(exclude_unset=True)
    return _run(admin_service.update_document_metadata, _client(), actor, document_id, updates)


@router.get("/documents/{document_id}/revisions")
def list_revisions(document_id: str, actor: Actor = _actor("admin.documents.read")):
    return _run(admin_service.list_revisions, _client(), actor, document_id)


@router.post("/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_id: Optional[str] = Form(default=None),
    actor: Actor = _actor("admin.documents.write"),
):
    from routers.documents import (
        get_bucket,
        ingest_uploaded_document,
        utc_now_iso,
        validate_uploaded_pdf_bytes,
    )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 5 MB.")
    if not content.startswith(PDF_MAGIC):
        raise HTTPException(status_code=400, detail="Invalid PDF file.")
    validate_uploaded_pdf_bytes(content)

    document_id = str(uuid.uuid4())
    safe_name = os.path.basename(file.filename)
    storage_path = f"{document_id}/{safe_name}"
    client = _client()
    if source_id is not None and not source_id.strip():
        raise HTTPException(status_code=400, detail="A source ID cannot be blank")
    source = _run(
        admin_service.verified_source_for_upload, client, actor, source_id.strip()
    ) if source_id is not None else None
    storage = client.storage.from_(get_bucket())
    try:
        storage.upload(storage_path, content, {"content-type": "application/pdf"})
    except Exception as exc:
        logger.error("[Admin] Upload failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Upload service unavailable") from exc

    try:
        client.table(documents_table()).insert(
            {
                "id": document_id,
                "name": safe_name,
                "size_bytes": len(content),
                "chunk_count": 0,
                "status": "processing",
                "uploaded_at": utc_now_iso(),
                "storage_path": storage_path,
                "public_url": None,
                "error_message": None,
                "visibility_scope": "private",
                "publication_status": "draft",
                "owner_type": "operator",
                "owner_id": actor.subject,
                "document_version": 1,
                "source_id": source.get("source_id") if source else None,
                "source_type": source.get("source_type") if source else None,
            }
        ).execute()
    except Exception as exc:
        try:
            storage.remove([storage_path])
        except Exception as cleanup_exc:
            logger.error(
                "[Admin] Upload cleanup failed for %s: %s",
                document_id,
                type(cleanup_exc).__name__,
            )
        logger.error("[Admin] Document registration failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Upload service unavailable") from exc

    admin_service.audit(
        client,
        actor,
        action="document.ingest",
        target_type="document",
        target_id=document_id,
        details={
            "name": safe_name,
            "size_bytes": len(content),
            "source_id": source.get("source_id") if source else None,
        },
    )
    background_tasks.add_task(
        ingest_uploaded_document, document_id, content, safe_name
    )
    return {"id": document_id, "name": safe_name, "status": "processing"}


@router.get("/sources")
def list_sources(
    q: Optional[str] = None,
    verification_status: Optional[str] = None,
    actor: Actor = _actor("admin.sources.read"),
):
    return _run(
        admin_service.list_sources,
        _client(),
        actor,
        query=q,
        verification_status=verification_status,
    )


@router.post("/sources", status_code=201)
def create_source(body: SourceCreate, actor: Actor = _actor("admin.sources.write")):
    return _run(
        admin_service.create_source,
        _client(),
        actor,
        body.model_dump(exclude_unset=True),
    )


@router.get("/sources/{source_id}")
def get_source(source_id: str, actor: Actor = _actor("admin.sources.read")):
    sources = _run(admin_service.list_sources, _client(), actor)
    for source in sources:
        if source["source_id"] == source_id:
            return source
    raise HTTPException(status_code=404, detail="Source not found")


@router.patch("/sources/{source_id}")
def update_source(
    source_id: str, body: SourceUpdate, actor: Actor = _actor("admin.sources.write")
):
    return _run(
        admin_service.update_source,
        _client(),
        actor,
        source_id,
        body.model_dump(exclude_unset=True),
    )


@router.post("/sources/{source_id}/verify")
def verify_source(
    source_id: str, body: SourceVerify, actor: Actor = _actor("admin.sources.verify")
):
    return _run(
        admin_service.verify_source,
        _client(),
        actor,
        source_id,
        evidence=body.evidence,
        freshness_days=body.freshness_days,
        usage_rights=body.usage_rights,
        usage_permitted=body.usage_permitted,
    )


@router.post("/sources/{source_id}/revoke")
def revoke_source(
    source_id: str, body: ReasonRequest, actor: Actor = _actor("admin.sources.verify")
):
    if not (body.reason or "").strip():
        raise HTTPException(status_code=400, detail="A reason is required")
    return _run(
        admin_service.revoke_source,
        _client(),
        actor,
        source_id,
        reason=body.reason or "",
    )


@router.get("/review-queue")
def review_queue(actor: Actor = _actor("admin.review")):
    return _run(admin_service.review_queue, _client(), actor)


@router.post("/documents/{document_id}/review")
def review_document(
    document_id: str, body: ReviewRequest, actor: Actor = _actor("admin.review")
):
    return _run(
        admin_service.review_document,
        _client(),
        actor,
        document_id,
        action=body.action,
        reason=body.reason,
    )


@router.post("/documents/{document_id}/publish")
def publish_document(
    document_id: str, body: ReasonRequest, actor: Actor = _actor("admin.publish")
):
    return _run(
        admin_service.publish_document,
        _client(),
        actor,
        document_id,
        reason=body.reason,
    )


@router.post("/documents/{document_id}/suspend")
def suspend_document(
    document_id: str, body: ReasonRequest, actor: Actor = _actor("admin.publish")
):
    if not (body.reason or "").strip():
        raise HTTPException(status_code=400, detail="A reason is required")
    return _run(
        admin_service.lifecycle_action,
        _client(),
        actor,
        document_id,
        action="suspend",
        reason=body.reason,
    )


@router.post("/documents/{document_id}/withdraw")
def withdraw_document(
    document_id: str, body: ReasonRequest, actor: Actor = _actor("admin.publish")
):
    if not (body.reason or "").strip():
        raise HTTPException(status_code=400, detail="A reason is required")
    return _run(
        admin_service.lifecycle_action,
        _client(),
        actor,
        document_id,
        action="withdraw",
        reason=body.reason,
    )


@router.get("/audit-logs")
def audit_logs(
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    target_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    actor: Actor = _actor("admin.audit.read"),
):
    return _run(
        admin_service.list_audit_logs,
        _client(),
        actor,
        action=action,
        actor_id=actor_id,
        target_id=target_id,
        page=page,
        page_size=page_size,
    )


@router.get("/roles")
def list_roles(actor: Actor = _actor("admin.roles.read")):
    return _run(admin_service.list_roles, _client(), actor)


@router.post("/roles", status_code=201)
def grant_role(body: RoleGrant, actor: Actor = _actor("admin.roles.manage")):
    return _run(
        admin_service.grant_role,
        _client(),
        actor,
        target_actor_id=body.target_actor_id,
        role=body.role,
        reason=body.reason,
    )


@router.post("/roles/revoke")
def revoke_role(body: RoleRevoke, actor: Actor = _actor("admin.roles.manage")):
    return _run(
        admin_service.revoke_role,
        _client(),
        actor,
        target_actor_id=body.target_actor_id,
        role=body.role,
        reason=body.reason,
    )


@router.get("/status")
def system_status(actor: Actor = _actor("admin.status.read")):
    return _run(admin_service.system_status, _client(), actor)
