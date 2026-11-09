"""Admin ingestion API: discovery, candidates, jobs and processing."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from utils import admin_service, revision_lifecycle
from utils.authorization import Actor, require_permission
from utils.ingestion import service

logger = logging.getLogger("admin_ingestion_router")
router = APIRouter()
documents_router = APIRouter()


def _actor(permission: str):
    return Depends(require_permission(permission))


def _client():
    from utils.auth import get_supabase

    return get_supabase(admin=True)


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except service.IngestionValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.IngestionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.IngestionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except service.IngestionUnavailable as exc:
        logger.error("[Ingestion] Unavailable: %s", exc)
        raise HTTPException(
            status_code=503, detail="Ingestion service is temporarily unavailable."
        ) from exc


class SkipRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=1, max_length=2000)


class RevisionReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str
    reason: Optional[str] = Field(default=None, max_length=2000)


class RevisionActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Optional[str] = Field(default=None, max_length=2000)


def _run_revision(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except revision_lifecycle.RevisionValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except revision_lifecycle.RevisionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except revision_lifecycle.RevisionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except revision_lifecycle.RevisionUnavailable as exc:
        logger.error("[Revision] Unavailable: %s", exc)
        raise HTTPException(
            status_code=503, detail="Revision service is temporarily unavailable."
        ) from exc


@router.get("/overview")
def overview(actor: Actor = _actor("admin.ingestion.read")):
    return _run(service.ingestion_overview, _client(), actor)


@router.post("/sources/{source_id}/discover")
def discover(
    source_id: str,
    background_tasks: BackgroundTasks,
    actor: Actor = _actor("admin.ingestion.write"),
):
    client = _client()
    job = _run(service.start_discovery, client, actor, source_id)
    if job.get("status") == "queued":
        background_tasks.add_task(service.run_discovery, client, job["id"])
    return job


@router.get("/candidates")
def candidates(
    source_id: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    actor: Actor = _actor("admin.ingestion.read"),
):
    return _run(
        service.list_candidates,
        _client(),
        actor,
        source_id=source_id,
        status=status,
        query=q,
        page=page,
        page_size=page_size,
    )


@router.get("/candidates/{candidate_id}")
def candidate(candidate_id: str, actor: Actor = _actor("admin.ingestion.read")):
    return _run(service.get_candidate, _client(), actor, candidate_id)


@router.post("/candidates/{candidate_id}/ingest")
def ingest_candidate(
    candidate_id: str,
    background_tasks: BackgroundTasks,
    actor: Actor = _actor("admin.ingestion.write"),
):
    client = _client()
    job = _run(service.start_ingest, client, actor, candidate_id)
    if job.get("status") == "queued":
        background_tasks.add_task(service.run_ingest, client, job["id"])
    return job


@router.post("/candidates/{candidate_id}/skip")
def skip_candidate(
    candidate_id: str,
    body: SkipRequest,
    actor: Actor = _actor("admin.ingestion.write"),
):
    return _run(service.skip_candidate, _client(), actor, candidate_id, body.reason)


@router.get("/jobs")
def jobs(
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    actor: Actor = _actor("admin.ingestion.read"),
):
    return _run(
        service.list_jobs,
        _client(),
        actor,
        status=status,
        job_type=job_type,
        page=page,
        page_size=page_size,
    )


@router.get("/jobs/{job_id}")
def job(job_id: str, actor: Actor = _actor("admin.ingestion.read")):
    return _run(service.get_job, _client(), actor, job_id)


@router.post("/jobs/{job_id}/retry")
def retry(
    job_id: str,
    background_tasks: BackgroundTasks,
    actor: Actor = _actor("admin.ingestion.write"),
):
    client = _client()
    updated = _run(service.retry_job, client, actor, job_id)
    if updated.get("status") == "queued":
        if updated.get("job_type") == "discovery":
            background_tasks.add_task(service.run_discovery, client, job_id)
        else:
            background_tasks.add_task(service.run_ingest, client, job_id)
    return updated


@router.post("/jobs/{job_id}/cancel")
def cancel(job_id: str, actor: Actor = _actor("admin.ingestion.write")):
    return _run(service.cancel_job, _client(), actor, job_id)


@documents_router.get("/{document_id}/revisions/{revision}")
def revision_detail(
    document_id: str,
    revision: int,
    actor: Actor = _actor("admin.documents.read"),
):
    return _run_revision(
        revision_lifecycle.get_revision, _client(), actor, document_id, revision
    )


@documents_router.post("/{document_id}/revisions/{revision}/review")
def review_revision(
    document_id: str,
    revision: int,
    body: RevisionReviewRequest,
    actor: Actor = _actor("admin.review"),
):
    return _run_revision(
        revision_lifecycle.review_revision,
        _client(),
        actor,
        document_id,
        revision,
        action=body.action,
        reason=body.reason,
    )


@documents_router.post("/{document_id}/revisions/{revision}/promote")
def promote_revision(
    document_id: str,
    revision: int,
    body: RevisionActionRequest,
    actor: Actor = _actor("admin.publish"),
):
    return _run_revision(
        revision_lifecycle.promote_revision,
        _client(),
        actor,
        document_id,
        revision,
        reason=body.reason,
    )


@documents_router.post("/{document_id}/revisions/{revision}/rollback")
def rollback_revision(
    document_id: str,
    revision: int,
    body: RevisionActionRequest,
    actor: Actor = _actor("admin.publish"),
):
    if not (body.reason or "").strip():
        raise HTTPException(status_code=400, detail="A rollback reason is required")
    return _run_revision(
        revision_lifecycle.rollback_revision,
        _client(),
        actor,
        document_id,
        revision,
        reason=body.reason or "",
    )


@documents_router.get("/{document_id}/processing")
def document_processing(
    document_id: str, actor: Actor = _actor("admin.ingestion.read")
):
    return _run(service.document_processing, _client(), actor, document_id)


@documents_router.post("/{document_id}/reprocess")
def reprocess(
    document_id: str,
    background_tasks: BackgroundTasks,
    actor: Actor = _actor("admin.ingestion.write"),
):
    client = _client()
    job = _run(service.start_reprocess, client, actor, document_id)
    if job.get("status") == "queued":
        background_tasks.add_task(service.run_ingest, client, job["id"])
    return job
