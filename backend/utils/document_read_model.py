"""Read-only views over admin documents, revisions and sources.

This module sits below both ``admin_service`` and ``revision_lifecycle`` so
neither has to import the other for serialization or document detail reads.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Mapping, Optional

from utils.admin_errors import AdminNotFound, AdminUnavailable
from utils.publication_store import (
    events_table,
    fetch_documents,
    revisions_table,
    sources_table,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(timezone.utc)


def _is_missing_table(exc: Exception) -> bool:
    text = str(exc)
    return "42P01" in text or "PGRST205" in text


def read_rows(client: Any, table: str) -> list[dict[str, Any]]:
    try:
        result = client.table(table).select("*").execute()
    except Exception as exc:
        if _is_missing_table(exc):
            raise AdminUnavailable(f"{table} is not provisioned") from exc
        raise AdminUnavailable(f"Could not read {table}") from exc
    return [row for row in (getattr(result, "data", None) or []) if isinstance(row, dict)]


def documents(client: Any) -> list[dict[str, Any]]:
    try:
        return fetch_documents(client)
    except Exception as exc:
        raise AdminUnavailable("Could not read documents") from exc


def source_map(client: Any) -> dict[str, dict[str, Any]]:
    return {
        str(row.get("source_id")): row
        for row in read_rows(client, sources_table())
        if row.get("source_id")
    }


def revision_for(
    row: Mapping[str, Any], revisions: Iterable[Mapping[str, Any]]
) -> Optional[Mapping[str, Any]]:
    current = row.get("current_revision") or row.get("document_version")
    document_id = str(row.get("id") or "")
    try:
        current_revision = int(current)
    except (TypeError, ValueError):
        return None
    matches = [
        rev
        for rev in revisions
        if str(rev.get("document_id") or "") == document_id
        and int(rev.get("revision") or 0) == current_revision
    ]
    return matches[0] if len(matches) == 1 else None


def document_view(
    row: Mapping[str, Any],
    *,
    source: Optional[Mapping[str, Any]] = None,
    revision: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """Browser-safe admin view: never expose storage paths or signed URLs."""
    return {
        "id": str(row.get("id", "")),
        "name": row.get("name", ""),
        "size_bytes": int(row.get("size_bytes", 0) or 0),
        "chunk_count": int(row.get("chunk_count", 0) or 0),
        "status": row.get("status", ""),
        "uploaded_at": str(row.get("uploaded_at") or ""),
        "agency": row.get("agency"),
        "is_featured": bool(row.get("is_featured", False)),
        "visibility_scope": row.get("visibility_scope") or "unclassified",
        "publication_status": row.get("publication_status") or "draft",
        "source_id": row.get("source_id"),
        "source_type": row.get("source_type"),
        "owner_type": row.get("owner_type"),
        "approved_by": row.get("approved_by"),
        "approved_at": row.get("approved_at"),
        "published_at": row.get("published_at"),
        "expires_at": row.get("expires_at"),
        "last_verified_at": row.get("last_verified_at"),
        "current_revision": row.get("current_revision") or row.get("document_version") or 1,
        "error_message": row.get("error_message"),
        "has_storage": bool(row.get("storage_path")),
        "source": source_view(source) if source else None,
        "revision": revision_view(revision) if revision else None,
    }


def source_view(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "source_id": row.get("source_id", ""),
        "issuing_organization": row.get("issuing_organization", ""),
        "authority": row.get("authority"),
        "source_url": row.get("source_url"),
        "source_type": row.get("source_type", ""),
        "verification_status": row.get("verification_status", "unverified"),
        "verified_by": row.get("verified_by"),
        "verified_at": row.get("verified_at"),
        "usage_rights": row.get("usage_rights"),
        "usage_permitted": bool(row.get("usage_permitted", False)),
        "freshness_days": row.get("freshness_days"),
        "last_verified_at": row.get("last_verified_at"),
        "revoked_at": row.get("revoked_at"),
        "metadata": row.get("metadata") or {},
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def revision_view(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "revision": row.get("revision"),
        "source_id": row.get("source_id"),
        "source_type": row.get("source_type"),
        "checksum": row.get("checksum"),
        "approved_by": row.get("approved_by"),
        "approved_at": row.get("approved_at"),
        "created_at": row.get("created_at"),
        "superseded_at": row.get("superseded_at"),
        "revoked_at": row.get("revoked_at"),
        "has_storage": bool(row.get("storage_path")),
        "is_current": False,
        "indexing_status": row.get("indexing_status") or "pending",
        "indexed_at": row.get("indexed_at"),
        "chunk_count": int(row.get("chunk_count") or 0),
        "index_error": row.get("index_error"),
        "review_status": row.get("review_status") or "pending",
        "review_reason": row.get("review_reason"),
        "reviewed_by": row.get("reviewed_by"),
        "reviewed_at": row.get("reviewed_at"),
    }


def publication_blockers(
    document: Mapping[str, Any],
    source: Optional[Mapping[str, Any]],
    revision: Optional[Mapping[str, Any]],
    *,
    now: Optional[datetime] = None,
) -> list[str]:
    moment = now or _now()
    blockers: list[str] = []
    if document.get("status") != "ready":
        blockers.append("processing_not_ready")
    if not document.get("approved_by") or not document.get("approved_at"):
        blockers.append("missing_approval")
    if not source:
        blockers.append("missing_source")
    else:
        if source.get("verification_status") != "verified":
            blockers.append("source_not_verified")
        if source.get("usage_permitted") is not True:
            blockers.append("usage_not_permitted")
        if not str(source.get("usage_rights") or "").strip():
            blockers.append("source_usage_rights_missing")
        if source.get("revoked_at"):
            blockers.append("source_revoked")
        freshness = source.get("freshness_days")
        verified = _parse(source.get("last_verified_at"))
        if (
            not isinstance(freshness, int)
            or isinstance(freshness, bool)
            or freshness <= 0
            or freshness > 3650
        ):
            blockers.append("source_freshness_policy_missing")
        elif verified is None or verified > moment:
            blockers.append("source_verification_time_invalid")
        elif moment - verified > timedelta(days=freshness):
            blockers.append("source_stale")
    if revision is None:
        blockers.append("missing_current_revision")
    else:
        if revision.get("superseded_at") or revision.get("revoked_at"):
            blockers.append("revision_not_current")
        if not revision.get("storage_path"):
            blockers.append("revision_storage_missing")
        if not revision.get("approved_by") or not revision.get("approved_at"):
            blockers.append("revision_not_approved")
        if revision.get("indexing_status") != "indexed":
            blockers.append("revision_not_indexed")
        elif int(revision.get("chunk_count") or 0) <= 0:
            blockers.append("revision_index_empty")
    expiry = _parse(document.get("expires_at"))
    if document.get("expires_at") and (expiry is None or expiry <= moment):
        blockers.append("expired")
    if document.get("revoked_at") or document.get("superseded_by"):
        blockers.append("revoked")
    return blockers


def document_detail(client: Any, document_id: str) -> dict[str, Any]:
    """Full browser-safe detail for one admin document."""
    row = next((doc for doc in documents(client) if str(doc.get("id")) == document_id), None)
    if row is None:
        raise AdminNotFound("Document not found")
    source = source_map(client).get(str(row.get("source_id") or ""))
    revisions = [
        rev for rev in read_rows(client, revisions_table()) if rev.get("document_id") == document_id
    ]
    revision = revision_for(row, revisions)
    view = document_view(row, source=source, revision=revision)
    current_revision = row.get("current_revision") or row.get("document_version")
    revision_views = []
    for rev in revisions:
        item = revision_view(rev)
        item["is_current"] = str(rev.get("revision")) == str(current_revision)
        revision_views.append(item)
    view["revisions"] = revision_views
    events = [
        ev for ev in read_rows(client, events_table()) if ev.get("document_id") == document_id
    ]
    view["events"] = sorted(events, key=lambda ev: str(ev.get("occurred_at") or ""), reverse=True)
    view["blockers"] = publication_blockers(row, source, revision)
    return view
