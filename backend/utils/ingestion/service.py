"""Official document ingestion pipeline.

Discovery, secure fetch, extraction, duplicate detection, registration and
processing. Nothing here approves or publishes a document: new documents are
private/draft and new revisions are unapproved and pending review.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import tempfile
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional

from utils import admin_service
from utils.ingestion import security
from utils.ingestion.connectors import (
    ConnectorError,
    DiscoveredDocument,
    connector_for,
)
from utils.ingestion.extraction import ExtractionError, ExtractionResult, extract_pdf
from utils.publication_store import (
    documents_table,
    fetch_documents,
    fetch_revisions,
    revisions_table,
    sources_table,
)

logger = logging.getLogger("ingestion.service")

CANDIDATES_TABLE = "ingestion_candidates"
JOBS_TABLE = "ingestion_jobs"
CHECKPOINTS_TABLE = "source_discovery_checkpoints"
MAX_ATTEMPTS = 3
STALE_JOB_MINUTES = 15
_job_workers: dict[str, str] = {}


class IngestionUnavailable(RuntimeError):
    """Ingestion persistence or a required service is unavailable."""


class IngestionNotFound(RuntimeError):
    """Candidate, source, job or document not found."""


class IngestionConflict(RuntimeError):
    """The requested operation is not valid in the current state."""


class IngestionValidationError(ValueError):
    """Input or source configuration is invalid."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Optional[datetime] = None) -> str:
    return (value or _now()).isoformat()


def _is_missing_table(exc: Exception) -> bool:
    text = str(exc)
    return "42P01" in text or "PGRST205" in text


def _read(client: Any, table: str) -> list[dict[str, Any]]:
    try:
        result = client.table(table).select("*").execute()
    except Exception as exc:
        raise IngestionUnavailable(f"Could not read {table}") from exc
    return [row for row in (getattr(result, "data", None) or []) if isinstance(row, dict)]


def _insert(client: Any, table: str, payload: Mapping[str, Any]) -> dict[str, Any]:
    try:
        result = client.table(table).insert(dict(payload)).execute()
    except Exception as exc:
        raise IngestionUnavailable(f"Could not write {table}") from exc
    rows = getattr(result, "data", None) or []
    return rows[0] if rows and isinstance(rows[0], dict) else dict(payload)


def _update(client: Any, table: str, filters: Mapping[str, Any], payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    try:
        query = client.table(table).update(dict(payload))
        for key, value in filters.items():
            query = query.eq(key, value)
        result = query.execute()
    except Exception as exc:
        raise IngestionUnavailable(f"Could not update {table}") from exc
    return [row for row in (getattr(result, "data", None) or []) if isinstance(row, dict)]


def _bucket() -> str:
    return os.getenv("SUPABASE_BUCKET", "documents")


def _safe_filename(title: str, url: str) -> str:
    candidate = title.strip() or url.rsplit("/", 1)[-1] or "document.pdf"
    candidate = os.path.basename(candidate)
    candidate = re.sub(r"[^A-Za-z0-9._ -]+", "_", candidate).strip(" ._")
    if not candidate.lower().endswith(".pdf"):
        candidate = f"{candidate}.pdf"
    return candidate[:160] or "document.pdf"


def _title_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _normalize_date(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# Sources and candidates
# ---------------------------------------------------------------------------


def _source(client: Any, source_id: str) -> dict[str, Any]:
    row = next(
        (source for source in _read(client, sources_table()) if source.get("source_id") == source_id),
        None,
    )
    if row is None:
        raise IngestionNotFound("Source not found")
    return row


def require_verified_source(source: Mapping[str, Any], *, now: Optional[datetime] = None) -> None:
    """Ingestion only runs for verified, permitted, unrevoked sources."""
    moment = now or _now()
    if source.get("verification_status") != "verified":
        raise IngestionValidationError("Source is not verified")
    if source.get("usage_permitted") is not True:
        raise IngestionValidationError("Source usage is not permitted")
    if source.get("revoked_at"):
        raise IngestionValidationError("Source is revoked")
    freshness = source.get("freshness_days")
    verified = source.get("last_verified_at")
    if isinstance(freshness, int) and freshness > 0 and isinstance(verified, str):
        parsed = _normalize_date(verified)
        if parsed and moment - parsed > timedelta(days=freshness):
            raise IngestionValidationError("Source verification is stale")


def _candidate_view(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row.get("id", "")),
        "source_id": row.get("source_id"),
        "external_id": row.get("external_id"),
        "source_url": row.get("source_url"),
        "canonical_url": row.get("canonical_url"),
        "title": row.get("title"),
        "issuing_organization": row.get("issuing_organization"),
        "document_type": row.get("document_type"),
        "language": row.get("language"),
        "file_format": row.get("file_format") or "pdf",
        "publication_date": row.get("publication_date"),
        "last_updated_at": row.get("last_updated_at"),
        "discovered_at": row.get("discovered_at"),
        "status": row.get("status"),
        "duplicate_class": row.get("duplicate_class"),
        "checksum": row.get("checksum"),
        "document_id": row.get("document_id"),
        "revision": row.get("revision"),
        "extraction_status": row.get("extraction_status"),
        "ocr_required": bool(row.get("ocr_required")),
        "page_count": int(row.get("page_count") or 0),
        "skip_reason": row.get("skip_reason"),
        "error_message": row.get("error_message"),
        "metadata": row.get("metadata") or {},
    }


def list_candidates(
    client: Any,
    actor: Any,
    *,
    source_id: Optional[str] = None,
    status: Optional[str] = None,
    query: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict[str, Any]:
    del actor
    rows = _read(client, CANDIDATES_TABLE)
    text = (query or "").strip().lower()

    def matches(row: Mapping[str, Any]) -> bool:
        if source_id and row.get("source_id") != source_id:
            return False
        if status and row.get("status") != status:
            return False
        if text:
            haystack = " ".join(
                str(row.get(key) or "") for key in ("title", "source_url", "external_id", "issuing_organization")
            ).lower()
            if text not in haystack:
                return False
        return True

    filtered = sorted(
        (row for row in rows if matches(row)),
        key=lambda row: str(row.get("discovered_at") or ""),
        reverse=True,
    )
    total = len(filtered)
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    start = (page - 1) * page_size
    return {
        "items": [_candidate_view(row) for row in filtered[start : start + page_size]],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_candidate(client: Any, actor: Any, candidate_id: str) -> dict[str, Any]:
    del actor
    row = next((item for item in _read(client, CANDIDATES_TABLE) if str(item.get("id")) == candidate_id), None)
    if row is None:
        raise IngestionNotFound("Candidate not found")
    view = _candidate_view(row)
    jobs = [job for job in _read(client, JOBS_TABLE) if str(job.get("candidate_id")) == candidate_id]
    view["jobs"] = [_job_view(job) for job in sorted(jobs, key=lambda j: str(j.get("created_at") or ""), reverse=True)]
    return view


def skip_candidate(client: Any, actor: Any, candidate_id: str, reason: str) -> dict[str, Any]:
    reason = (reason or "").strip()
    if not reason:
        raise IngestionValidationError("A reason is required")
    row = next((item for item in _read(client, CANDIDATES_TABLE) if str(item.get("id")) == candidate_id), None)
    if row is None:
        raise IngestionNotFound("Candidate not found")
    if row.get("status") in {"ingested", "ingesting"}:
        raise IngestionConflict("Ingested candidates cannot be skipped")
    _update(
        client,
        CANDIDATES_TABLE,
        {"id": candidate_id},
        {"status": "skipped", "skip_reason": reason, "updated_at": _iso()},
    )
    admin_service.audit(
        client,
        actor,
        action="ingestion.candidate_skip",
        target_type="ingestion_candidate",
        target_id=candidate_id,
        reason=reason,
    )
    return get_candidate(client, actor, candidate_id)


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


def _job_view(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row.get("id", "")),
        "job_type": row.get("job_type"),
        "source_id": row.get("source_id"),
        "candidate_id": row.get("candidate_id"),
        "document_id": row.get("document_id"),
        "status": row.get("status"),
        "stage": row.get("stage"),
        "progress": int(row.get("progress") or 0),
        "attempts": int(row.get("attempts") or 0),
        "max_attempts": int(row.get("max_attempts") or MAX_ATTEMPTS),
        "error_message": row.get("error_message"),
        "failure_class": row.get("failure_class"),
        "worker_id": row.get("worker_id"),
        "lease_expires_at": row.get("lease_expires_at"),
        "heartbeat_at": row.get("heartbeat_at"),
        "next_retry_at": row.get("next_retry_at"),
        "cancel_requested": bool(row.get("cancel_requested")),
        "details": row.get("details") or {},
        "created_at": row.get("created_at"),
        "started_at": row.get("started_at"),
        "finished_at": row.get("finished_at"),
    }


def recover_stale_jobs(client: Any) -> int:
    now = _now()
    cutoff = now - timedelta(minutes=STALE_JOB_MINUTES)
    recovered = 0
    for job in _read(client, JOBS_TABLE):
        if job.get("status") != "running":
            continue
        lease = _normalize_date(str(job.get("lease_expires_at") or ""))
        started = _normalize_date(str(job.get("started_at") or ""))
        expired = (lease is not None and lease < now) or (
            lease is None and started is not None and started < cutoff
        )
        if expired:
            filters: dict[str, Any] = {"id": job.get("id"), "status": "running"}
            if job.get("worker_id"):
                filters["worker_id"] = job.get("worker_id")
            # Compare the observed lease: a heartbeat may renew it after our read.
            if job.get("lease_expires_at") is not None:
                filters["lease_expires_at"] = job["lease_expires_at"]
            elif job.get("started_at") is not None:
                filters["started_at"] = job["started_at"]
            rows = _update(
                client,
                JOBS_TABLE,
                filters,
                {
                    "status": "failed",
                    "stage": "lease_expired",
                    "failure_class": "transient",
                    "error_message": "Worker lease expired; safe to retry",
                    "worker_id": None,
                    "lease_expires_at": None,
                    "finished_at": _iso(),
                    "updated_at": _iso(),
                },
            )
            recovered += len(rows)
    return recovered


def claim_next_job(client: Any, worker_id: str, lease_seconds: int = 1800) -> Optional[dict[str, Any]]:
    """Claim one queued, due job. Conditional update prevents double claiming."""
    recover_stale_jobs(client)
    due = [
        job
        for job in _read(client, JOBS_TABLE)
        if job.get("status") == "queued"
        and (
            not job.get("next_retry_at")
            or (_normalize_date(str(job.get("next_retry_at") or "")) or _now()) <= _now()
        )
    ]
    due.sort(key=lambda job: str(job.get("created_at") or ""))
    for job in due:
        rows = _update(
            client,
            JOBS_TABLE,
            {"id": job.get("id"), "status": "queued"},
            {
                "status": "running",
                "stage": "starting",
                "progress": 5,
                "attempts": int(job.get("attempts") or 0) + 1,
                "worker_id": worker_id,
                "lease_expires_at": (_now() + timedelta(seconds=lease_seconds)).isoformat(),
                "heartbeat_at": _iso(),
                "started_at": _iso(),
                "updated_at": _iso(),
            },
        )
        if rows:
            _bind_worker(rows[0])
            return _job_view(rows[0])
    return None


def list_jobs(
    client: Any,
    actor: Any,
    *,
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict[str, Any]:
    del actor
    recover_stale_jobs(client)
    rows = _read(client, JOBS_TABLE)
    filtered = [
        row
        for row in rows
        if (not status or row.get("status") == status)
        and (not job_type or row.get("job_type") == job_type)
    ]
    filtered.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
    total = len(filtered)
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    start = (page - 1) * page_size
    return {
        "items": [_job_view(row) for row in filtered[start : start + page_size]],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_job(client: Any, actor: Any, job_id: str) -> dict[str, Any]:
    del actor
    row = next((item for item in _read(client, JOBS_TABLE) if str(item.get("id")) == job_id), None)
    if row is None:
        raise IngestionNotFound("Job not found")
    return _job_view(row)


def _create_job(
    client: Any,
    *,
    job_type: str,
    source_id: Optional[str] = None,
    candidate_id: Optional[str] = None,
    document_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    requested_by: Optional[str] = None,
) -> dict[str, Any]:
    active = [
        job
        for job in _read(client, JOBS_TABLE)
        if job.get("status") in {"queued", "running"}
        and (
            (candidate_id and str(job.get("candidate_id")) == candidate_id)
            or (job_type == "discovery" and source_id and job.get("source_id") == source_id)
        )
    ]
    if active:
        return _job_view(active[0])
    payload = {
        "id": str(uuid.uuid4()),
        "job_type": job_type,
        "source_id": source_id,
        "candidate_id": candidate_id,
        "document_id": document_id,
        "status": "queued",
        "progress": 0,
        "attempts": 0,
        "max_attempts": MAX_ATTEMPTS,
        "correlation_id": correlation_id or uuid.uuid4().hex,
        "details": {"requested_by": requested_by or "ingestion-pipeline"},
        "created_at": _iso(),
        "updated_at": _iso(),
    }
    try:
        return _job_view(_insert(client, JOBS_TABLE, payload))
    except IngestionUnavailable:
        # A concurrent request may have won the active-job unique index.
        active = [
            job
            for job in _read(client, JOBS_TABLE)
            if job.get("status") in {"queued", "running"}
            and (
                (candidate_id and str(job.get("candidate_id")) == candidate_id)
                or (job_type == "discovery" and source_id and job.get("source_id") == source_id)
            )
        ]
        if active:
            return _job_view(active[0])
        raise


def start_discovery(client: Any, actor: Any, source_id: str) -> dict[str, Any]:
    source = _source(client, source_id)
    require_verified_source(source)
    try:
        connector_for(source).validate_configuration(source)
    except ConnectorError as exc:
        raise IngestionValidationError(str(exc)) from exc
    job = _create_job(client, job_type="discovery", source_id=source_id, requested_by=actor.subject)
    admin_service.audit(
        client,
        actor,
        action="ingestion.discovery_queue",
        target_type="source",
        target_id=source_id,
        details={"job_id": job["id"]},
    )
    return job


def start_ingest(client: Any, actor: Any, candidate_id: str) -> dict[str, Any]:
    row = next((item for item in _read(client, CANDIDATES_TABLE) if str(item.get("id")) == candidate_id), None)
    if row is None:
        raise IngestionNotFound("Candidate not found")
    if row.get("status") in {"ingested", "unchanged"}:
        raise IngestionConflict("Candidate already has a document")
    require_verified_source(_source(client, str(row.get("source_id"))))
    job = _create_job(client, job_type="ingest", candidate_id=candidate_id, source_id=str(row.get("source_id")), requested_by=actor.subject)
    _update(client, CANDIDATES_TABLE, {"id": candidate_id}, {"status": "queued", "updated_at": _iso()})
    admin_service.audit(
        client,
        actor,
        action="ingestion.ingest_queue",
        target_type="ingestion_candidate",
        target_id=candidate_id,
        details={"job_id": job["id"]},
    )
    return job


def start_reprocess(client: Any, actor: Any, document_id: str) -> dict[str, Any]:
    document = next((doc for doc in _documents(client) if str(doc.get("id")) == document_id), None)
    if document is None:
        raise IngestionNotFound("Document not found")
    if document.get("publication_status") == "published":
        raise IngestionConflict("Reprocess the pending revision instead of the published document")
    job = _create_job(client, job_type="ingest", document_id=document_id, requested_by=actor.subject)
    admin_service.audit(
        client,
        actor,
        action="ingestion.reprocess_queue",
        target_type="document",
        target_id=document_id,
        details={"job_id": job["id"]},
    )
    return job


def retry_job(client: Any, actor: Any, job_id: str) -> dict[str, Any]:
    row = next((item for item in _read(client, JOBS_TABLE) if str(item.get("id")) == job_id), None)
    if row is None:
        raise IngestionNotFound("Job not found")
    if row.get("status") != "failed":
        raise IngestionConflict("Only failed jobs can be retried")
    if int(row.get("attempts") or 0) >= int(row.get("max_attempts") or MAX_ATTEMPTS):
        raise IngestionConflict("Retry limit reached")
    rows = _update(
        client,
        JOBS_TABLE,
        {"id": job_id, "status": "failed", "attempts": row.get("attempts", 0)},
        {
            "status": "queued",
            "stage": None,
            "progress": 0,
            "error_message": None,
            "failure_class": None,
            "finished_at": None,
            "worker_id": None,
            "lease_expires_at": None,
            "cancel_requested": False,
            "next_retry_at": (_now() + timedelta(minutes=min(2 ** int(row.get("attempts") or 0), 60))).isoformat(),
            "updated_at": _iso(),
        },
    )
    if not rows:
        raise IngestionConflict("Job changed while scheduling retry")
    admin_service.audit(
        client,
        actor,
        action="ingestion.job_retry",
        target_type="ingestion_job",
        target_id=job_id,
    )
    return get_job(client, actor, job_id)


def cancel_job(client: Any, actor: Any, job_id: str) -> dict[str, Any]:
    row = next((item for item in _read(client, JOBS_TABLE) if str(item.get("id")) == job_id), None)
    if row is None:
        raise IngestionNotFound("Job not found")
    if row.get("status") == "running":
        _update(
            client,
            JOBS_TABLE,
            {"id": job_id},
            {"cancel_requested": True, "updated_at": _iso()},
        )
        admin_service.audit(
            client,
            actor,
            action="ingestion.job_cancel_requested",
            target_type="ingestion_job",
            target_id=job_id,
        )
        return get_job(client, actor, job_id)
    if row.get("status") != "queued":
        raise IngestionConflict("Only queued or running jobs can be cancelled")
    _update(
        client,
        JOBS_TABLE,
        {"id": job_id},
        {"status": "cancelled", "finished_at": _iso(), "updated_at": _iso()},
    )
    admin_service.audit(
        client,
        actor,
        action="ingestion.job_cancel",
        target_type="ingestion_job",
        target_id=job_id,
    )
    return get_job(client, actor, job_id)


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------


def _claim_job(client: Any, job_id: str) -> Optional[dict[str, Any]]:
    existing = next((row for row in _read(client, JOBS_TABLE) if str(row.get("id")) == job_id), None)
    attempts = int((existing or {}).get("attempts") or 0) + 1
    rows = _update(
        client,
        JOBS_TABLE,
        {"id": job_id, "status": "queued"},
        {
            "status": "running",
            "stage": "starting",
            "started_at": _iso(),
            "updated_at": _iso(),
            "progress": 5,
            "attempts": attempts,
            "worker_id": "request-background",
            "lease_expires_at": (_now() + timedelta(minutes=30)).isoformat(),
            "heartbeat_at": _iso(),
        },
    )
    if rows:
        _bind_worker(rows[0])
        return rows[0]
    return None


def _bind_worker(job: Mapping[str, Any]) -> None:
    if job.get("id"):
        _job_workers[str(job.get("id"))] = str(job.get("worker_id") or "")


def _worker_for(job_id: str) -> Optional[str]:
    return _job_workers.get(job_id)


def _job_progress(client: Any, job_id: str, stage: str, progress: int) -> bool:
    filters: dict[str, Any] = {"id": job_id, "status": "running"}
    worker = _worker_for(job_id)
    if worker:
        filters["worker_id"] = worker
    try:
        rows = _update(
            client,
            JOBS_TABLE,
            filters,
            {
                "stage": stage,
                "progress": progress,
                "heartbeat_at": _iso(),
                "lease_expires_at": (_now() + timedelta(minutes=30)).isoformat(),
                "updated_at": _iso(),
            },
        )
        return bool(rows)
    except IngestionUnavailable:
        logger.warning("[Ingestion] Could not update job progress for %s", job_id)
        return False


def _cancel_requested(client: Any, job_id: str) -> bool:
    try:
        rows = _read(client, JOBS_TABLE)
    except IngestionUnavailable:
        return False
    job = next((row for row in rows if str(row.get("id")) == job_id), None)
    return bool(job and job.get("cancel_requested"))


def _mark_cancelled(client: Any, job_id: str) -> None:
    _update(
        client,
        JOBS_TABLE,
        _owned_filters(job_id),
        {
            "status": "cancelled",
            "stage": "cancelled",
            "finished_at": _iso(),
            "updated_at": _iso(),
            "worker_id": None,
            "lease_expires_at": None,
        },
    )


def _owned_filters(job_id: str) -> dict[str, Any]:
    filters: dict[str, Any] = {"id": job_id, "status": "running"}
    worker = _worker_for(job_id)
    if worker:
        filters["worker_id"] = worker
    return filters


def _finish_job(client: Any, job_id: str, details: Mapping[str, Any], *, stage: str = "completed") -> bool:
    rows = _update(
        client,
        JOBS_TABLE,
        _owned_filters(job_id),
        {
            "status": "completed",
            "stage": stage,
            "progress": 100,
            "finished_at": _iso(),
            "updated_at": _iso(),
            "worker_id": None,
            "lease_expires_at": None,
            "cancel_requested": False,
            "details": dict(details),
        },
    )
    return bool(rows)


def _fail_job(
    client: Any, job_id: str, message: str, *, stage: str = "failed", failure_class: str = "transient"
) -> bool:
    safe = message[:500] if message else "Ingestion failed"
    rows = _update(
        client,
        JOBS_TABLE,
        _owned_filters(job_id),
        {
            "status": "failed",
            "stage": stage,
            "failure_class": failure_class,
            "error_message": safe,
            "finished_at": _iso(),
            "updated_at": _iso(),
            "worker_id": None,
            "lease_expires_at": None,
        },
    )
    return bool(rows)


def _fetch_listing(url: str, source: Mapping[str, Any]):
    return security.fetch_listing(url, source)


def _fetch_document(url: str, source: Mapping[str, Any]):
    return security.fetch_document(url, source)


def run_discovery(client: Any, job_id: str, *, claimed: bool = False) -> None:
    if claimed:
        job = next((row for row in _read(client, JOBS_TABLE) if str(row.get("id")) == job_id), None)
    else:
        job = _claim_job(client, job_id)
    if job is None:
        return
    _bind_worker(job)
    if job.get("cancel_requested"):
        _mark_cancelled(client, job_id)
        return
    source_id = str(job.get("source_id") or "")
    try:
        source = _source(client, source_id)
        require_verified_source(source)
        connector = connector_for(source)
        _job_progress(client, job_id, "discovering", 20)
        documents = connector.discover_documents(
            source, lambda url: _fetch_listing(url, source)
        )
        if _cancel_requested(client, job_id):
            _mark_cancelled(client, job_id)
            return
        _job_progress(client, job_id, "registering_candidates", 70)
        existing = _read(client, CANDIDATES_TABLE)
        by_url = {
            (row.get("source_id"), row.get("canonical_url")): row for row in existing
        }
        created = 0
        for document in documents:
            key = (document.source_id, document.source_url)
            current = by_url.get(key)
            payload = {
                "source_id": document.source_id,
                "external_id": document.external_id or None,
                "source_url": document.source_url,
                "canonical_url": document.source_url,
                "title": document.title,
                "issuing_organization": source.get("issuing_organization"),
                "document_type": document.document_type,
                "language": document.language or None,
                "publication_date": document.publication_date or None,
                "last_updated_at": document.last_updated_at or None,
                "discovery_evidence": dict(document.evidence),
                "updated_at": _iso(),
            }
            if current:
                # Never reset a human decision or an existing document link.
                if current.get("status") in {"discovered", "failed", "duplicate_review"}:
                    _update(client, CANDIDATES_TABLE, {"id": current.get("id")}, payload)
            else:
                payload.update(
                    {
                        "id": str(uuid.uuid4()),
                        "status": "discovered",
                        "discovered_at": _iso(),
                        "created_at": _iso(),
                    }
                )
                created += 1
                _insert(client, CANDIDATES_TABLE, payload)
        checkpoints = _read(client, CHECKPOINTS_TABLE)
        checkpoint = next((row for row in checkpoints if row.get("source_id") == source_id), None)
        checkpoint_payload = {
            "source_id": source_id,
            "last_discovered_at": _iso(),
            "last_success_at": _iso(),
            "last_error": None,
            "updated_at": _iso(),
        }
        if checkpoint:
            _update(client, CHECKPOINTS_TABLE, {"source_id": source_id}, checkpoint_payload)
        else:
            _insert(client, CHECKPOINTS_TABLE, checkpoint_payload)
        _finish_job(
            client,
            job_id,
            {"discovered": len(documents), "new_candidates": created},
            stage="discovery_complete",
        )
        logger.info("[Ingestion] Discovery %s found %d documents", source_id, len(documents))
    except Exception as exc:
        _fail_job(client, job_id, _safe_error(exc), failure_class=_failure_class(exc))
        _record_checkpoint_error(client, source_id, _safe_error(exc))
        logger.warning("[Ingestion] Discovery failed for %s: %s", source_id, type(exc).__name__)


def _safe_error(exc: Exception) -> str:
    if isinstance(exc, (IngestionValidationError, IngestionNotFound, IngestionConflict, ConnectorError, security.FetchError, ExtractionError)):
        return str(exc)
    return f"{type(exc).__name__} while processing ingestion"


def _failure_class(exc: Exception) -> str:
    if isinstance(
        exc,
        (
            IngestionValidationError,
            IngestionNotFound,
            IngestionConflict,
            ConnectorError,
            security.URLRejected,
            ExtractionError,
        ),
    ):
        return "permanent"
    return "transient"


def _record_checkpoint_error(client: Any, source_id: str, message: str) -> None:
    try:
        checkpoints = _read(client, CHECKPOINTS_TABLE)
        if any(row.get("source_id") == source_id for row in checkpoints):
            _update(
                client,
                CHECKPOINTS_TABLE,
                {"source_id": source_id},
                {"last_error": message[:500], "updated_at": _iso()},
            )
        else:
            _insert(
                client,
                CHECKPOINTS_TABLE,
                {"source_id": source_id, "last_error": message[:500], "updated_at": _iso()},
            )
    except IngestionUnavailable:
        logger.warning("[Ingestion] Could not record discovery error for %s", source_id)


def _documents(client: Any) -> list[dict[str, Any]]:
    try:
        return fetch_documents(client)
    except Exception as exc:
        raise IngestionUnavailable("Could not read documents") from exc


def _revisions(client: Any) -> list[dict[str, Any]]:
    try:
        return fetch_revisions(client)
    except Exception as exc:
        raise IngestionUnavailable("Could not read document revisions") from exc


@dataclass(frozen=True)
class DuplicateDecision:
    kind: str  # new | unchanged | new_revision | duplicate_review
    document_id: Optional[str] = None
    revision: Optional[Mapping[str, Any]] = None
    reason: str = ""


def classify_duplicate(
    candidate: Mapping[str, Any],
    checksum: str,
    documents: list[dict[str, Any]],
    revisions: list[dict[str, Any]],
    *,
    title: str = "",
    publication_date: str = "",
) -> DuplicateDecision:
    source_id = str(candidate.get("source_id") or "")
    external_id = str(candidate.get("external_id") or "")
    url = str(candidate.get("canonical_url") or candidate.get("source_url") or "")

    for revision in revisions:
        if revision.get("checksum") == checksum:
            document_id = str(revision.get("document_id"))
            document = next((doc for doc in documents if str(doc.get("id")) == document_id), None)
            if document and document.get("source_id") == source_id:
                return DuplicateDecision("unchanged", document_id, revision, "identical content")
            return DuplicateDecision(
                "duplicate_review",
                document_id,
                revision,
                "identical checksum belongs to a different source",
            )

    for document in documents:
        same_external = (
            external_id
            and document.get("source_id") == source_id
            and str(document.get("external_id") or "") == external_id
        )
        same_url = document.get("source_id") == source_id and document.get("source_url") == url
        if not (same_external or same_url):
            continue
        revisions_for_doc = [rev for rev in revisions if str(rev.get("document_id")) == str(document.get("id"))]
        current = document.get("current_revision") or document.get("document_version")
        current_revision = next((rev for rev in revisions_for_doc if rev.get("revision") == current), None)
        if current_revision and current_revision.get("checksum") == checksum:
            return DuplicateDecision("unchanged", str(document.get("id")), current_revision, "same as current revision")
        return DuplicateDecision(
            "new_revision",
            str(document.get("id")),
            max(revisions_for_doc, key=lambda rev: int(rev.get("revision") or 0)) if revisions_for_doc else None,
            "content changed for an existing source document",
        )

    normalized_title = _title_key(title or str(candidate.get("title") or ""))
    organization = str(candidate.get("issuing_organization") or "")
    if normalized_title and publication_date:
        for document in documents:
            if (
                _title_key(str(document.get("name") or "")) == normalized_title
                and str(document.get("agency") or "") == organization
                and str(document.get("publication_date") or "").startswith(publication_date[:10])
            ):
                return DuplicateDecision(
                    "duplicate_review",
                    str(document.get("id")),
                    None,
                    "similar title/organisation/date requires manual review",
                )
    return DuplicateDecision("new")


def _extract_or_fail(content: bytes) -> ExtractionResult:
    if not content.startswith(b"%PDF-"):
        raise ExtractionError("Downloaded file is not a PDF")
    return extract_pdf(content)


def _upload_pdf(client: Any, path: str, content: bytes) -> None:
    try:
        client.storage.from_(_bucket()).upload(
            path, content, {"content-type": "application/pdf"}
        )
    except Exception as exc:
        raise IngestionUnavailable("Could not store the document") from exc


def _index_document(
    document_id: str, revision: int, source_id: str, content: bytes, filename: str
) -> dict[str, Any]:
    from utils.rag_pipeline import ingest_revision

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
        handle.write(content)
        path = handle.name
    try:
        return ingest_revision(
            pdf_path=path,
            document_id=document_id,
            revision=revision,
            source_id=source_id,
            document_name=filename,
        )
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def _base_document_payload(
    *,
    document_id: str,
    candidate: Mapping[str, Any],
    source: Mapping[str, Any],
    extraction: ExtractionResult,
    checksum: str,
    storage_path: str,
    filename: str,
    actor: Any,
) -> dict[str, Any]:
    title = (
        str(candidate.get("title") or "").strip()
        or extraction.title
        or filename
    )[:180]
    return {
        "id": document_id,
        "name": title,
        "size_bytes": 0,
        "chunk_count": 0,
        "status": "processing",
        "uploaded_at": _iso(),
        "storage_path": storage_path,
        "public_url": None,
        "error_message": None,
        "visibility_scope": "private",
        "publication_status": "draft",
        "source_id": source.get("source_id"),
        "source_type": source.get("source_type"),
        "source_url": candidate.get("canonical_url") or candidate.get("source_url"),
        "external_id": candidate.get("external_id"),
        "checksum": checksum,
        "document_type": candidate.get("document_type") or "pdf",
        "language": extraction.language or candidate.get("language"),
        "publication_date": candidate.get("publication_date") or None,
        "last_updated_at": candidate.get("last_updated_at") or None,
        "retrieved_at": _iso(),
        "extraction_status": extraction.extraction_status,
        "extraction_method": extraction.extraction_method,
        "ocr_required": extraction.ocr_required,
        "page_count": extraction.page_count,
        "owner_type": "operator",
        "owner_id": actor.subject,
        "approved_by": None,
        "approved_at": None,
        "published_at": None,
        "last_verified_at": None,
        "document_version": 1,
        "current_revision": 1,
    }


def _register_new_document(
    client: Any,
    candidate: Mapping[str, Any],
    source: Mapping[str, Any],
    content: bytes,
    extraction: ExtractionResult,
    checksum: str,
    filename: str,
    actor: Any,
) -> tuple[str, int]:
    document_id = str(uuid.uuid4())
    storage_path = f"{document_id}/revision-1-{filename}"
    _upload_pdf(client, storage_path, content)
    payload = _base_document_payload(
        document_id=document_id,
        candidate=candidate,
        source=source,
        extraction=extraction,
        checksum=checksum,
        storage_path=storage_path,
        filename=filename,
        actor=actor,
    )
    payload["size_bytes"] = len(content)
    _insert(client, documents_table(), payload)
    _insert(
        client,
        revisions_table(),
        {
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "revision": 1,
            "source_id": source.get("source_id"),
            "source_type": source.get("source_type"),
            "storage_path": storage_path,
            "checksum": checksum,
            "approved_by": None,
            "approved_at": None,
            "created_at": _iso(),
            "indexing_status": "indexing",
            "review_status": "pending",
            "metadata": {
                "source_url": candidate.get("canonical_url"),
                "external_id": candidate.get("external_id"),
                "retrieved_at": _iso(),
                "requires_review": True,
                "extraction_status": extraction.extraction_status,
                "page_count": extraction.page_count,
            },
        },
    )

    if extraction.ocr_required:
        _update(
            client,
            documents_table(),
            {"id": document_id},
            {
                "status": "processing",
                "error_message": "OCR required before indexing",
            },
        )
        _update(
            client,
            revisions_table(),
            {"document_id": document_id, "revision": 1},
            {
                "indexing_status": "pending",
                "index_error": "OCR required before indexing",
            },
        )
        return document_id, 0

    try:
        indexed = _index_document(document_id, 1, str(source.get("source_id") or ""), content, filename)
    except Exception as exc:
        _update(
            client,
            documents_table(),
            {"id": document_id},
            {"status": "error", "error_message": _safe_error(exc)},
        )
        _update(
            client,
            revisions_table(),
            {"document_id": document_id, "revision": 1},
            {"indexing_status": "failed", "index_error": _safe_error(exc)},
        )
        raise
    chunks = int(indexed.get("chunk_count") or 0)
    if chunks <= 0:
        _update(
            client,
            documents_table(),
            {"id": document_id},
            {"status": "error", "error_message": "No searchable text was indexed"},
        )
        _update(
            client,
            revisions_table(),
            {"document_id": document_id, "revision": 1},
            {"indexing_status": "failed", "index_error": "No searchable text was indexed"},
        )
        raise IngestionValidationError("No searchable text was indexed")

    _update(
        client,
        revisions_table(),
        {"document_id": document_id, "revision": 1},
        {
            "indexing_status": "indexed",
            "indexed_at": indexed.get("indexed_at") or _iso(),
            "chunk_count": chunks,
            "index_namespace": indexed.get("namespace"),
            "verification_chunk_ids": list(indexed.get("sample_chunk_ids") or []),
            "index_error": None,
        },
    )
    _update(
        client,
        documents_table(),
        {"id": document_id},
        {"status": "ready", "chunk_count": chunks, "error_message": None},
    )
    return document_id, chunks


def _register_new_revision(
    client: Any,
    candidate: Mapping[str, Any],
    source: Mapping[str, Any],
    document_id: str,
    revisions: list[dict[str, Any]],
    content: bytes,
    extraction: ExtractionResult,
    checksum: str,
    filename: str,
) -> int:
    revision_no = max((int(rev.get("revision") or 0) for rev in revisions), default=0) + 1
    storage_path = f"{document_id}/revision-{revision_no}-{filename}"
    _upload_pdf(client, storage_path, content)
    _insert(
        client,
        revisions_table(),
        {
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "revision": revision_no,
            "source_id": source.get("source_id"),
            "source_type": source.get("source_type"),
            "storage_path": storage_path,
            "checksum": checksum,
            "approved_by": None,
            "approved_at": None,
            "created_at": _iso(),
            "indexing_status": "indexing",
            "review_status": "pending",
            "metadata": {
                "source_url": candidate.get("canonical_url"),
                "external_id": candidate.get("external_id"),
                "retrieved_at": _iso(),
                "requires_review": True,
                "extraction_status": extraction.extraction_status,
                "page_count": extraction.page_count,
            },
        },
    )
    if extraction.ocr_required:
        _update(
            client,
            revisions_table(),
            {"document_id": document_id, "revision": revision_no},
            {"indexing_status": "pending", "index_error": "OCR required before indexing"},
        )
        return revision_no

    # Pending revision indexes into its own isolated namespace. It never
    # becomes public until approval + explicit promotion.
    try:
        indexed = _index_document(
            document_id, revision_no, str(source.get("source_id") or ""), content, filename
        )
    except Exception as exc:
        _update(
            client,
            revisions_table(),
            {"document_id": document_id, "revision": revision_no},
            {"indexing_status": "failed", "index_error": _safe_error(exc)},
        )
        raise
    chunks = int(indexed.get("chunk_count") or 0)
    if chunks <= 0:
        _update(
            client,
            revisions_table(),
            {"document_id": document_id, "revision": revision_no},
            {"indexing_status": "failed", "index_error": "No searchable text was indexed"},
        )
        raise IngestionValidationError("No searchable text was indexed")
    _update(
        client,
        revisions_table(),
        {"document_id": document_id, "revision": revision_no},
        {
            "indexing_status": "indexed",
            "indexed_at": indexed.get("indexed_at") or _iso(),
            "chunk_count": chunks,
            "index_namespace": indexed.get("namespace"),
            "verification_chunk_ids": list(indexed.get("sample_chunk_ids") or []),
            "index_error": None,
        },
    )
    return revision_no


def _store_download(content: bytes, max_bytes: int) -> None:
    if len(content) > max_bytes:
        raise IngestionValidationError("Document exceeds the size limit")
    if not content.startswith(b"%PDF-"):
        raise IngestionValidationError("Downloaded file is not a PDF")


def run_ingest(client: Any, job_id: str, *, claimed: bool = False) -> None:
    if claimed:
        job = next((row for row in _read(client, JOBS_TABLE) if str(row.get("id")) == job_id), None)
    else:
        job = _claim_job(client, job_id)
    if job is None:
        return
    _bind_worker(job)
    if job.get("cancel_requested"):
        _mark_cancelled(client, job_id)
        return
    candidate_id = job.get("candidate_id")
    document_id_job = job.get("document_id")
    try:
        if candidate_id:
            candidate = next(
                (row for row in _read(client, CANDIDATES_TABLE) if str(row.get("id")) == str(candidate_id)),
                None,
            )
            if candidate is None:
                raise IngestionNotFound("Candidate not found")
            source = _source(client, str(candidate.get("source_id")))
            require_verified_source(source)
            _job_progress(client, job_id, "downloading", 15)
            result = _fetch_document(str(candidate.get("source_url")), source)
            _store_download(result.content, security.MAX_DOCUMENT_BYTES)
            checksum = hashlib.sha256(result.content).hexdigest()
            _job_progress(client, job_id, "extracting", 35)
            extraction = _extract_or_fail(result.content)
            if _cancel_requested(client, job_id):
                _mark_cancelled(client, job_id)
                return
            filename = _safe_filename(str(candidate.get("title") or ""), str(candidate.get("source_url")))
            _job_progress(client, job_id, "deduplicating", 55)
            decision = classify_duplicate(
                candidate,
                checksum,
                _documents(client),
                _revisions(client),
                title=str(candidate.get("title") or extraction.title),
                publication_date=str(candidate.get("publication_date") or ""),
            )
            details: dict[str, Any] = {
                "duplicate_class": decision.kind,
                "checksum": checksum,
                "page_count": extraction.page_count,
                "ocr_required": extraction.ocr_required,
            }
            if decision.kind == "unchanged":
                _update(
                    client,
                    CANDIDATES_TABLE,
                    {"id": candidate_id},
                    {
                        "status": "unchanged",
                        "duplicate_class": "unchanged",
                        "checksum": checksum,
                        "document_id": decision.document_id,
                        "extraction_status": extraction.extraction_status,
                        "page_count": extraction.page_count,
                        "ocr_required": extraction.ocr_required,
                        "updated_at": _iso(),
                    },
                )
                _finish_job(client, job_id, details, stage="unchanged")
                return
            if decision.kind == "duplicate_review":
                _update(
                    client,
                    CANDIDATES_TABLE,
                    {"id": candidate_id},
                    {
                        "status": "duplicate_review",
                        "duplicate_class": decision.kind,
                        "checksum": checksum,
                        "document_id": decision.document_id,
                        "extraction_status": extraction.extraction_status,
                        "page_count": extraction.page_count,
                        "updated_at": _iso(),
                    },
                )
                _finish_job(client, job_id, details, stage="duplicate_review")
                return

            if decision.kind == "new_revision" and decision.document_id:
                _job_progress(client, job_id, "storing_revision", 70)
                revision = _register_new_revision(
                    client,
                    candidate,
                    source,
                    decision.document_id,
                    _revisions(client),
                    result.content,
                    extraction,
                    checksum,
                    filename,
                )
                _update(
                    client,
                    CANDIDATES_TABLE,
                    {"id": candidate_id},
                    {
                        "status": "ocr_required" if extraction.ocr_required else "ingested",
                        "duplicate_class": "new_revision",
                        "checksum": checksum,
                        "document_id": decision.document_id,
                        "revision": revision,
                        "extraction_status": extraction.extraction_status,
                        "page_count": extraction.page_count,
                        "ocr_required": extraction.ocr_required,
                        "updated_at": _iso(),
                    },
                )
                admin_service.audit(
                    client,
                    _job_actor(job),
                    action="document.revision_ingest",
                    target_type="document",
                    target_id=decision.document_id,
                    details={"revision": revision, "candidate_id": str(candidate_id)},
                )
                _finish_job(
                    client,
                    job_id,
                    {**details, "revision": revision},
                    stage="ocr_required" if extraction.ocr_required else "review_required",
                )
                return

            _job_progress(client, job_id, "registering", 70)
            document_id, chunks = _register_new_document(
                client, candidate, source, result.content, extraction, checksum, filename, _job_actor(job)
            )
            _update(
                client,
                CANDIDATES_TABLE,
                {"id": candidate_id},
                {
                    "status": "ocr_required" if extraction.ocr_required else "ingested",
                    "duplicate_class": "new",
                    "checksum": checksum,
                    "document_id": document_id,
                    "revision": 1,
                    "extraction_status": extraction.extraction_status,
                    "page_count": extraction.page_count,
                    "ocr_required": extraction.ocr_required,
                    "updated_at": _iso(),
                },
            )
            admin_service.audit(
                client,
                _job_actor(job),
                action="document.ingest",
                target_type="document",
                target_id=document_id,
                details={
                    "candidate_id": str(candidate_id),
                    "source_id": source.get("source_id"),
                    "chunks": chunks,
                    "ocr_required": extraction.ocr_required,
                },
            )
            _finish_job(
                client,
                job_id,
                {**details, "document_id": document_id, "chunks": chunks},
                stage="ocr_required" if extraction.ocr_required else "review_ready",
            )
            return

        # Reprocess path: reindex an existing private/unpublished document.
        document = next(
            (doc for doc in _documents(client) if str(doc.get("id")) == str(document_id_job)),
            None,
        )
        if document is None:
            raise IngestionNotFound("Document not found")
        if document.get("publication_status") == "published":
            raise IngestionConflict("Published documents are not reprocessed in place")
        storage_path = document.get("storage_path")
        if not storage_path:
            raise IngestionValidationError("Document has no stored file")
        _job_progress(client, job_id, "downloading", 20)
        try:
            content = client.storage.from_(_bucket()).download(str(storage_path))
        except Exception as exc:
            raise IngestionUnavailable("Could not read the stored document") from exc
        _store_download(content, security.MAX_DOCUMENT_BYTES)
        extraction = _extract_or_fail(content)
        if extraction.ocr_required:
            _update(
                client,
                documents_table(),
                {"id": str(document_id_job)},
                {"status": "processing", "extraction_status": "ocr_required", "ocr_required": True},
            )
            _finish_job(client, job_id, {"ocr_required": True}, stage="ocr_required")
            return
        revision_no = int(document.get("current_revision") or document.get("document_version") or 1)
        indexed = _index_document(
            str(document_id_job),
            revision_no,
            str(document.get("source_id") or ""),
            content,
            str(document.get("name") or "document"),
        )
        chunks = int(indexed.get("chunk_count") or 0)
        _update(
            client,
            revisions_table(),
            {"document_id": str(document_id_job), "revision": revision_no},
            {
                "indexing_status": "indexed",
                "indexed_at": indexed.get("indexed_at") or _iso(),
                "chunk_count": chunks,
                "index_namespace": indexed.get("namespace"),
                "verification_chunk_ids": list(indexed.get("sample_chunk_ids") or []),
                "index_error": None,
            },
        )
        _update(
            client,
            documents_table(),
            {"id": str(document_id_job)},
            {
                "status": "ready",
                "chunk_count": chunks,
                "extraction_status": extraction.extraction_status,
                "ocr_required": False,
                "page_count": extraction.page_count,
                "error_message": None,
            },
        )
        _finish_job(client, job_id, {"document_id": str(document_id_job), "chunks": chunks}, stage="reprocessed")
        admin_service.audit(
            client,
            _job_actor(job),
            action="document.reprocess",
            target_type="document",
            target_id=str(document_id_job),
            details={"chunks": chunks},
        )
    except Exception as exc:
        message = _safe_error(exc)
        if candidate_id:
            try:
                _update(
                    client,
                    CANDIDATES_TABLE,
                    {"id": candidate_id},
                    {"status": "failed", "error_message": message, "updated_at": _iso()},
                )
            except IngestionUnavailable:
                pass
        _fail_job(client, job_id, message, failure_class=_failure_class(exc))
        logger.warning("[Ingestion] Job %s failed: %s", job_id, message)


class _JobActor:
    kind = "operator"

    def __init__(self, subject: str) -> None:
        self.subject = subject


def _job_actor(job: Mapping[str, Any]) -> Any:
    details = job.get("details") or {}
    subject = str(details.get("requested_by") or "ingestion-pipeline")
    return _JobActor(subject)


# ---------------------------------------------------------------------------
# Overview and processing views
# ---------------------------------------------------------------------------


def ingestion_overview(client: Any, actor: Any) -> dict[str, Any]:
    del actor
    recover_stale_jobs(client)
    candidates = _read(client, CANDIDATES_TABLE)
    jobs = _read(client, JOBS_TABLE)
    documents = _documents(client)
    counts = {status: 0 for status in (
        "discovered", "queued", "ingesting", "ingested", "unchanged",
        "duplicate_review", "ocr_required", "skipped", "failed",
    )}
    for row in candidates:
        status = str(row.get("status") or "discovered")
        counts[status] = counts.get(status, 0) + 1
    job_counts = {status: 0 for status in ("queued", "running", "completed", "failed", "cancelled")}
    for row in jobs:
        status = str(row.get("status") or "queued")
        job_counts[status] = job_counts.get(status, 0) + 1
    awaiting_review = sum(
        1
        for doc in documents
        if doc.get("status") == "ready" and doc.get("publication_status") in (None, "draft", "review")
    )
    checkpoints = _read(client, CHECKPOINTS_TABLE)
    return {
        "generated_at": _iso(),
        "candidates": {"total": len(candidates), **counts},
        "jobs": {"total": len(jobs), **job_counts},
        "documents": {
            "awaiting_review": awaiting_review,
            "ocr_required": sum(1 for doc in documents if doc.get("ocr_required")),
            "failed_processing": sum(1 for doc in documents if doc.get("status") == "error"),
        },
        "sources": [
            {
                "source_id": row.get("source_id"),
                "issuing_organization": row.get("issuing_organization"),
                "source_type": row.get("source_type"),
                "verification_status": row.get("verification_status"),
                "last_discovered_at": next(
                    (cp.get("last_discovered_at") for cp in checkpoints if cp.get("source_id") == row.get("source_id")),
                    None,
                ),
                "last_error": next(
                    (cp.get("last_error") for cp in checkpoints if cp.get("source_id") == row.get("source_id")),
                    None,
                ),
            }
            for row in _read(client, sources_table())
            if row.get("verification_status") == "verified" and row.get("usage_permitted") is True
        ],
    }


def document_processing(client: Any, actor: Any, document_id: str) -> dict[str, Any]:
    del actor
    document = next((doc for doc in _documents(client) if str(doc.get("id")) == document_id), None)
    if document is None:
        raise IngestionNotFound("Document not found")
    revisions = [rev for rev in _revisions(client) if str(rev.get("document_id")) == document_id]
    return {
        "document_id": document_id,
        "status": document.get("status"),
        "extraction_status": document.get("extraction_status"),
        "extraction_method": document.get("extraction_method"),
        "ocr_required": bool(document.get("ocr_required")),
        "page_count": int(document.get("page_count") or 0),
        "chunk_count": int(document.get("chunk_count") or 0),
        "publication_status": document.get("publication_status"),
        "visibility_scope": document.get("visibility_scope"),
        "error_message": document.get("error_message"),
        "revisions": [
            {
                "revision": rev.get("revision"),
                "checksum": rev.get("checksum"),
                "approved": bool(rev.get("approved_by")),
                "current": rev.get("revision") == (document.get("current_revision") or document.get("document_version")),
                "created_at": rev.get("created_at"),
                "requires_review": bool((rev.get("metadata") or {}).get("requires_review")),
            }
            for rev in sorted(revisions, key=lambda item: int(item.get("revision") or 0), reverse=True)
        ],
    }
