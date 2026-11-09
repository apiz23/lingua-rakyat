"""Revision approval, promotion and rollback.

The currently published revision stays authoritative until an explicit,
authorized promotion updates ``current_revision`` under an optimistic lock.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional

from utils import admin_service
from utils.document_publication import _parse_aware_datetime
from utils.publication_store import (
    fetch_approved_sources,
    fetch_documents,
    fetch_revisions,
    revisions_table,
)

logger = logging.getLogger("revision_lifecycle")


class RevisionUnavailable(RuntimeError):
    pass


class RevisionNotFound(RuntimeError):
    pass


class RevisionConflict(RuntimeError):
    pass


class RevisionValidationError(ValueError):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Optional[datetime] = None) -> str:
    return (value or _now()).isoformat()


def _revision_view(row: Mapping[str, Any], *, current: Any = None) -> dict[str, Any]:
    metadata = row.get("metadata") or {}
    return {
        "revision": row.get("revision"),
        "document_id": row.get("document_id"),
        "source_id": row.get("source_id"),
        "source_type": row.get("source_type"),
        "checksum": row.get("checksum"),
        "approved_by": row.get("approved_by"),
        "approved_at": row.get("approved_at"),
        "review_status": row.get("review_status") or "pending",
        "review_reason": row.get("review_reason"),
        "reviewed_by": row.get("reviewed_by"),
        "reviewed_at": row.get("reviewed_at"),
        "indexing_status": row.get("indexing_status") or "pending",
        "indexed_at": row.get("indexed_at"),
        "chunk_count": int(row.get("chunk_count") or 0),
        "index_namespace": row.get("index_namespace"),
        "index_error": row.get("index_error"),
        "created_at": row.get("created_at"),
        "superseded_at": row.get("superseded_at"),
        "revoked_at": row.get("revoked_at"),
        "has_storage": bool(row.get("storage_path")),
        "is_current": str(row.get("revision")) == str(current),
        "extraction_status": metadata.get("extraction_status"),
        "page_count": metadata.get("page_count"),
        "requires_review": bool(metadata.get("requires_review")),
    }


def _document(client: Any, document_id: str) -> dict[str, Any]:
    document = next(
        (row for row in fetch_documents(client) if str(row.get("id")) == document_id), None
    )
    if document is None:
        raise RevisionNotFound("Document not found")
    return document


def _revision(client: Any, document_id: str, revision: int) -> dict[str, Any]:
    revision_row = next(
        (
            row
            for row in fetch_revisions(client)
            if str(row.get("document_id")) == document_id
            and int(row.get("revision") or 0) == int(revision)
        ),
        None,
    )
    if revision_row is None:
        raise RevisionNotFound("Revision not found")
    return revision_row


def _source(client: Any, source_id: Optional[str]) -> Optional[dict[str, Any]]:
    if not source_id:
        return None
    return fetch_approved_sources(client).get(source_id)


def _validate_source(source: Optional[Mapping[str, Any]], *, now: Optional[datetime] = None) -> None:
    moment = now or _now()
    if not source:
        raise RevisionValidationError("Document has no verified official source")
    if source.get("verification_status") != "verified":
        raise RevisionValidationError("Source is not verified")
    if source.get("usage_permitted") is not True:
        raise RevisionValidationError("Source usage is not permitted")
    if not str(source.get("usage_rights") or "").strip():
        raise RevisionValidationError("Source usage rights are missing")
    if source.get("revoked_at"):
        raise RevisionValidationError("Source is revoked")
    freshness = source.get("freshness_days")
    verified = _parse_aware_datetime(source.get("last_verified_at"))
    if (
        not isinstance(freshness, int)
        or isinstance(freshness, bool)
        or freshness <= 0
        or freshness > 3650
    ):
        raise RevisionValidationError("Source freshness policy is missing")
    if verified is None:
        raise RevisionValidationError("Source verification time is missing")
    if moment - verified > timedelta(days=freshness):
        raise RevisionValidationError("Source verification is stale")


def _validate_expiry(document: Mapping[str, Any], *, now: Optional[datetime] = None) -> None:
    if not document.get("expires_at"):
        return
    expiry = _parse_aware_datetime(document.get("expires_at"))
    if expiry is None or expiry <= (now or _now()):
        raise RevisionValidationError("Document is expired")


def _verify_index(revision: Mapping[str, Any]) -> None:
    if revision.get("indexing_status") != "indexed":
        raise RevisionValidationError("Revision indexing is not complete")
    if int(revision.get("chunk_count") or 0) <= 0:
        raise RevisionValidationError("Revision has no verified chunks")
    namespace = revision.get("index_namespace")
    if not namespace:
        raise RevisionValidationError("Revision has no index namespace")
    from utils.rag_pipeline import verify_revision_index

    try:
        verified = verify_revision_index(
            str(namespace),
            int(revision.get("chunk_count") or 0),
            sample_ids=revision.get("verification_chunk_ids") or None,
            document_id=str(revision.get("document_id") or "") or None,
            revision=int(revision.get("revision") or 0) or None,
        )
    except Exception as exc:
        raise RevisionUnavailable("Vector index is unavailable") from exc
    if not verified:
        raise RevisionValidationError("Index verification failed for this revision")


def get_revision(client: Any, actor: Any, document_id: str, revision: int) -> dict[str, Any]:
    del actor
    document = _document(client, document_id)
    row = _revision(client, document_id, revision)
    current = document.get("current_revision") or document.get("document_version")
    view = _revision_view(row, current=current)
    source = _source(client, row.get("source_id"))
    view["source"] = admin_service._source_view(source) if source else None
    return view


def list_revisions(client: Any, actor: Any, document_id: str) -> list[dict[str, Any]]:
    del actor
    document = _document(client, document_id)
    current = document.get("current_revision") or document.get("document_version")
    rows = [
        row for row in fetch_revisions(client) if str(row.get("document_id")) == document_id
    ]
    return [
        _revision_view(row, current=current)
        for row in sorted(rows, key=lambda item: int(item.get("revision") or 0), reverse=True)
    ]


def _rpc(client: Any, name: str, params: Mapping[str, Any]) -> dict[str, Any]:
    try:
        builder = client.rpc(name, dict(params))
        result = builder.execute() if hasattr(builder, "execute") else builder
    except Exception as exc:
        text = str(exc).lower()
        if "document_not_found" in text or "revision_not_found" in text or "p0002" in text:
            raise RevisionNotFound("Document or revision not found") from exc
        if (
            "concurrent_modification" in text
            or "40001" in text
            or "could not serialize" in text
        ):
            raise RevisionConflict("Revision changed concurrently; reload and retry") from exc
        known = (
            "revision_not_approved",
            "revision_not_indexed",
            "revision_revoked",
            "revision_already_approved",
            "revision_extraction_not_reviewable",
            "revision_not_current",
            "processing_not_ready",
            "document_already_published",
            "source_not_verified",
            "source_stale",
            "document_expired",
            "document_not_published",
            "promotion_target_not_newer",
            "rollback_target_not_older",
            "invalid_review_action",
            "invalid_lifecycle_action",
        )
        if any(marker in text for marker in known):
            raise RevisionValidationError("Revision lifecycle validation failed") from exc
        raise RevisionUnavailable("Atomic revision lifecycle is unavailable") from exc
    data = getattr(result, "data", None)
    if isinstance(data, list):
        data = data[0] if data else None
    if not isinstance(data, dict):
        raise RevisionUnavailable("Revision lifecycle returned no result")
    return data


def review_revision(
    client: Any,
    actor: Any,
    document_id: str,
    revision: int,
    *,
    action: str,
    reason: Optional[str] = None,
) -> dict[str, Any]:
    if action not in {"approve", "reject", "request_changes"}:
        raise RevisionValidationError("Unsupported review action")
    reason = (reason or "").strip()
    if action in {"reject", "request_changes"} and not reason:
        raise RevisionValidationError("A reason is required")
    document = _document(client, document_id)
    row = _revision(client, document_id, revision)
    if row.get("revoked_at"):
        raise RevisionConflict("Revision is revoked")
    if row.get("review_status") == "approved" and action == "approve":
        raise RevisionConflict("Revision is already approved")
    if action == "approve":
        _validate_source(_source(client, row.get("source_id")))
        _validate_expiry(document)
        _verify_index(row)

    _rpc(
        client,
        "review_document_revision",
        {
            "p_document_id": document_id,
            "p_revision": int(revision),
            "p_action": action,
            "p_actor": actor.subject or "",
            "p_reason": reason or None,
        },
    )
    return get_revision(client, actor, document_id, revision)


def review_current_document(
    client: Any,
    actor: Any,
    document_id: str,
    *,
    action: str,
    reason: Optional[str] = None,
) -> dict[str, Any]:
    """Review the active revision and synchronize document approval atomically."""
    if action not in {"approve", "reject", "request_changes"}:
        raise RevisionValidationError("Unsupported review action")
    reason = (reason or "").strip()
    if action in {"reject", "request_changes"} and not reason:
        raise RevisionValidationError("A reason is required")

    document = _document(client, document_id)
    if document.get("publication_status") == "published":
        raise RevisionConflict(
            "Published documents must be suspended or withdrawn, not re-reviewed"
        )
    revision = int(
        document.get("current_revision") or document.get("document_version") or 1
    )
    if action == "approve" and document.get("status") != "ready":
        raise RevisionValidationError("Document processing is not ready")
    try:
        row = _revision(client, document_id, revision)
    except RevisionNotFound:
        if action == "approve":
            raise
    else:
        if row.get("revoked_at"):
            raise RevisionConflict("Revision is revoked")
        if row.get("review_status") == "approved" and action == "approve":
            raise RevisionConflict("Revision is already approved")
        if action == "approve":
            _validate_source(_source(client, row.get("source_id")))
            _validate_expiry(document)
            _verify_index(row)

    _rpc(
        client,
        "review_current_document_revision",
        {
            "p_document_id": document_id,
            "p_revision": revision,
            "p_action": action,
            "p_actor": actor.subject or "",
            "p_reason": reason or None,
        },
    )
    return admin_service.get_document(client, actor, document_id)


def _update_revision(
    client: Any, document_id: str, revision: int, payload: Mapping[str, Any]
) -> list[dict[str, Any]]:
    try:
        result = (
            client.table(revisions_table())
            .update(dict(payload))
            .eq("document_id", document_id)
            .eq("revision", revision)
            .execute()
        )
    except Exception as exc:
        raise RevisionUnavailable("Could not update revision") from exc
    return [row for row in (getattr(result, "data", None) or []) if isinstance(row, dict)]


def _promote(
    client: Any,
    actor: Any,
    document_id: str,
    revision: int,
    *,
    reason: Optional[str],
    action: str,
) -> dict[str, Any]:
    document = _document(client, document_id)
    target = _revision(client, document_id, revision)
    current = document.get("current_revision") or document.get("document_version")
    if str(current) == str(revision):
        raise RevisionConflict("Revision is already current")
    if document.get("publication_status") != "published":
        raise RevisionConflict("Promotion applies to published documents; publish the document first")
    if target.get("review_status") != "approved" or not target.get("approved_by"):
        raise RevisionValidationError("Revision is not approved")
    if target.get("revoked_at"):
        raise RevisionValidationError("Revision is revoked")
    _validate_source(_source(client, target.get("source_id") or document.get("source_id")))
    _validate_expiry(document)
    _verify_index(target)
    if current is None:
        raise RevisionConflict("Document has no current revision")
    _rpc(
        client,
        "promote_document_revision",
        {
            "p_document_id": document_id,
            "p_revision": int(revision),
            "p_expected_current": int(current),
            "p_actor": actor.subject or "",
            "p_action": action,
            "p_reason": reason,
        },
    )
    return get_revision(client, actor, document_id, revision)


def promote_revision(
    client: Any,
    actor: Any,
    document_id: str,
    revision: int,
    *,
    reason: Optional[str] = None,
) -> dict[str, Any]:
    return _promote(client, actor, document_id, revision, reason=reason, action="promote")


def rollback_revision(
    client: Any,
    actor: Any,
    document_id: str,
    revision: int,
    *,
    reason: str,
) -> dict[str, Any]:
    reason = (reason or "").strip()
    if not reason:
        raise RevisionValidationError("A rollback reason is required")
    return _promote(client, actor, document_id, revision, reason=reason, action="rollback")
