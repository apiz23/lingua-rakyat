"""Admin business services for Lingua Rakyat.

All privileged behavior lives here so routers stay thin. Every function takes
an :class:`~utils.authorization.Actor`; routers have already enforced the
required permission. Service-role database access is server-only and every
mutation writes an append-only audit row.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Mapping, Optional

from utils.authorization import Actor
from utils.document_publication import is_publicly_eligible
from utils.publication_store import (
    documents_table,
    events_table,
    fetch_documents,
    revisions_table,
    sources_table,
)
from utils.role_provider import KNOWN_ROLES, ROLE_PERMISSIONS

logger = logging.getLogger("admin_service")

ROLES_TABLE = "lr_admin_roles"
AUDIT_TABLE = "admin_audit_log"

DASHBOARD_EXPIRING_DAYS = 30


class AdminUnavailable(RuntimeError):
    """Admin persistence is missing or unreachable; callers return 503."""


class AdminNotFound(RuntimeError):
    """Target resource does not exist."""


class AdminConflict(RuntimeError):
    """The requested transition is not valid for the current state."""


class AdminValidationError(ValueError):
    """Request data failed validation."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Optional[datetime] = None) -> str:
    return (value or _now()).isoformat()


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


def _read(client: Any, table: str) -> list[dict[str, Any]]:
    try:
        result = client.table(table).select("*").execute()
    except Exception as exc:
        if _is_missing_table(exc):
            raise AdminUnavailable(f"{table} is not provisioned") from exc
        raise AdminUnavailable(f"Could not read {table}") from exc
    return [row for row in (getattr(result, "data", None) or []) if isinstance(row, dict)]


def _insert(client: Any, table: str, payload: Mapping[str, Any]) -> dict[str, Any]:
    try:
        result = client.table(table).insert(dict(payload)).execute()
    except Exception as exc:
        raise AdminUnavailable(f"Could not write {table}") from exc
    rows = getattr(result, "data", None) or []
    return rows[0] if rows and isinstance(rows[0], dict) else dict(payload)


def _update(client: Any, table: str, key: str, value: str, payload: Mapping[str, Any]) -> None:
    try:
        client.table(table).update(dict(payload)).eq(key, value).execute()
    except Exception as exc:
        raise AdminUnavailable(f"Could not update {table}") from exc


def audit(
    client: Any,
    actor: Actor,
    *,
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    reason: Optional[str] = None,
    state_from: Optional[str] = None,
    state_to: Optional[str] = None,
    correlation_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    if not actor.subject:
        raise AdminUnavailable("Audit requires a verified actor")
    payload = {
        "actor_id": actor.subject,
        "actor_role": ",".join(sorted(_actor_roles(client, actor))),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "reason": reason,
        "state_from": state_from,
        "state_to": state_to,
        "correlation_id": correlation_id or uuid.uuid4().hex,
        "details": details or {},
        "created_at": _iso(),
    }
    try:
        client.table(AUDIT_TABLE).insert(payload).execute()
    except Exception as exc:
        if _is_missing_table(exc):
            raise AdminUnavailable("Admin audit log is not provisioned") from exc
        raise AdminUnavailable("Could not append audit event") from exc


def _actor_roles(client: Any, actor: Actor) -> set[str]:
    from utils.role_provider import active_roles

    try:
        return active_roles(actor.email or "", client)
    except Exception:
        # Role display in an audit row is best effort; the permission check
        # already happened before this operation ran.
        return set()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------


def _document_view(
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
        "source": _source_view(source) if source else None,
        "revision": _revision_view(revision) if revision else None,
    }


def _source_view(row: Mapping[str, Any]) -> dict[str, Any]:
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


def _revision_view(row: Mapping[str, Any]) -> dict[str, Any]:
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


def _revision_for(row: Mapping[str, Any], revisions: Iterable[Mapping[str, Any]]) -> Optional[Mapping[str, Any]]:
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


def _source_map(client: Any) -> dict[str, dict[str, Any]]:
    return {
        str(row.get("source_id")): row
        for row in _read(client, sources_table())
        if row.get("source_id")
    }


def _documents(client: Any) -> list[dict[str, Any]]:
    try:
        return fetch_documents(client)
    except Exception as exc:
        raise AdminUnavailable("Could not read documents") from exc


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


def _latest_review_actions(client: Any) -> dict[str, str]:
    latest: dict[str, str] = {}
    rows = sorted(
        _read(client, AUDIT_TABLE),
        key=lambda row: str(row.get("created_at") or ""),
        reverse=True,
    )
    for row in rows:
        action = str(row.get("action", ""))
        if not action.startswith("review."):
            continue
        target = str(row.get("target_id") or "")
        if target and target not in latest:
            latest[target] = action
    return latest


def dashboard(client: Any, actor: Actor) -> dict[str, Any]:
    docs = _documents(client)
    sources = _read(client, sources_table())
    audit_rows = sorted(_read(client, AUDIT_TABLE), key=lambda row: str(row.get("created_at") or ""), reverse=True)
    reviews = _latest_review_actions(client)
    now = _now()
    soon = now + timedelta(days=DASHBOARD_EXPIRING_DAYS)

    def published(row: Mapping[str, Any]) -> bool:
        return row.get("publication_status") == "published"

    expiring = 0
    expired = 0
    for row in docs:
        expiry = _parse(row.get("expires_at"))
        if expiry is None:
            continue
        if expiry <= now:
            expired += 1
        elif expiry <= soon:
            expiring += 1

    return {
        "generated_at": _iso(now),
        "metrics": {
            "total_documents": len(docs),
            "awaiting_review": sum(
                1
                for row in docs
                if row.get("status") == "ready"
                and row.get("publication_status") in (None, "draft", "review")
            ),
            "published": sum(1 for row in docs if published(row)),
            "approved": sum(1 for row in docs if row.get("publication_status") == "approved"),
            "rejected": sum(1 for action in reviews.values() if action == "review.reject"),
            "suspended": sum(1 for row in docs if row.get("publication_status") == "suspended"),
            "withdrawn": sum(1 for row in docs if row.get("publication_status") == "archived"),
            "expiring": expiring,
            "expired": expired,
            "unverified_sources": sum(
                1 for row in sources if row.get("verification_status") != "verified"
            ),
            "failed_ingestion": sum(1 for row in docs if row.get("status") == "error"),
        },
        "recent_activity": [_audit_view(row) for row in audit_rows[:10]],
    }


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


def list_documents(
    client: Any,
    actor: Actor,
    *,
    query: Optional[str] = None,
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
) -> dict[str, Any]:
    del actor
    docs = _documents(client)
    sources = _source_map(client)
    query_text = (query or "").strip().lower()
    date_from = _parse(uploaded_from)
    date_to = _parse(uploaded_to)

    def matches(row: Mapping[str, Any]) -> bool:
        if processing_status and row.get("status") != processing_status:
            return False
        if visibility and (row.get("visibility_scope") or "unclassified") != visibility:
            return False
        if publication_status and (row.get("publication_status") or "draft") != publication_status:
            return False
        if source_id and row.get("source_id") != source_id:
            return False
        uploaded = _parse(row.get("uploaded_at"))
        if date_from and (uploaded is None or uploaded < date_from):
            return False
        if date_to and (uploaded is None or uploaded > date_to):
            return False
        if query_text:
            haystack = " ".join(
                str(row.get(key) or "")
                for key in ("id", "name", "agency", "source_id", "source_type")
            ).lower()
            if query_text not in haystack:
                return False
        return True

    keys = {
        "uploaded_at": lambda row: str(row.get("uploaded_at") or ""),
        "name": lambda row: str(row.get("name") or "").lower(),
        "status": lambda row: str(row.get("status") or ""),
        "publication_status": lambda row: str(row.get("publication_status") or ""),
    }
    sorted_rows = sorted(filter(matches, docs), key=keys.get(sort, keys["uploaded_at"]), reverse=order != "asc")
    total = len(sorted_rows)
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    start = (page - 1) * page_size
    return {
        "items": [
            _document_view(row, source=sources.get(str(row.get("source_id") or "")))
            for row in sorted_rows[start : start + page_size]
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_document(client: Any, actor: Actor, document_id: str) -> dict[str, Any]:
    del actor
    row = next((doc for doc in _documents(client) if str(doc.get("id")) == document_id), None)
    if row is None:
        raise AdminNotFound("Document not found")
    source = _source_map(client).get(str(row.get("source_id") or ""))
    revisions = [rev for rev in _read(client, revisions_table()) if rev.get("document_id") == document_id]
    revision = _revision_for(row, revisions)
    view = _document_view(row, source=source, revision=revision)
    current_revision = row.get("current_revision") or row.get("document_version")
    revision_views = []
    for rev in revisions:
        item = _revision_view(rev)
        item["is_current"] = str(rev.get("revision")) == str(current_revision)
        revision_views.append(item)
    view["revisions"] = revision_views
    events = [ev for ev in _read(client, events_table()) if ev.get("document_id") == document_id]
    view["events"] = sorted(events, key=lambda ev: str(ev.get("occurred_at") or ""), reverse=True)
    view["blockers"] = publication_blockers(row, source, revision)
    return view


METADATA_FIELDS = {"name", "agency", "is_featured", "expires_at", "source_id"}


def update_document_metadata(
    client: Any,
    actor: Actor,
    document_id: str,
    updates: Mapping[str, Any],
    *,
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    row = next((doc for doc in _documents(client) if str(doc.get("id")) == document_id), None)
    if row is None:
        raise AdminNotFound("Document not found")
    unknown = set(updates) - METADATA_FIELDS
    if unknown:
        raise AdminValidationError(f"Unsupported metadata fields: {', '.join(sorted(unknown))}")

    payload: dict[str, Any] = {}
    if "name" in updates:
        name = str(updates["name"] or "").strip()
        if not name or len(name) > 180:
            raise AdminValidationError("name must be 1-180 characters")
        payload["name"] = name
    if "agency" in updates:
        agency = updates["agency"]
        payload["agency"] = str(agency).strip()[:120] if agency else None
    if "is_featured" in updates:
        payload["is_featured"] = bool(updates["is_featured"])
    if "expires_at" in updates:
        expiry = updates["expires_at"]
        if expiry:
            parsed = _parse(expiry)
            if parsed is None:
                raise AdminValidationError("expires_at must be an ISO timestamp with timezone")
            payload["expires_at"] = parsed.isoformat()
        else:
            payload["expires_at"] = None
    if "source_id" in updates:
        source_id = updates["source_id"]
        if source_id:
            source = _source_map(client).get(str(source_id))
            if source is None:
                raise AdminValidationError("Unknown source")
            payload["source_id"] = str(source_id)
            payload["source_type"] = source.get("source_type")
        else:
            payload["source_id"] = None
            payload["source_type"] = None

    if payload:
        _update(client, documents_table(), "id", document_id, payload)
        audit(
            client,
            actor,
            action="document.metadata_update",
            target_type="document",
            target_id=document_id,
            correlation_id=correlation_id,
            details={"fields": sorted(payload)},
        )
    return get_document(client, actor, document_id)


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------


SOURCE_FIELDS = {
    "issuing_organization",
    "authority",
    "source_url",
    "source_type",
    "usage_rights",
    "freshness_days",
    "metadata",
}


def list_sources(
    client: Any,
    actor: Actor,
    *,
    query: Optional[str] = None,
    verification_status: Optional[str] = None,
) -> list[dict[str, Any]]:
    del actor
    text = (query or "").strip().lower()
    items = []
    for row in _read(client, sources_table()):
        if verification_status and row.get("verification_status") != verification_status:
            continue
        if text:
            haystack = " ".join(
                str(row.get(key) or "")
                for key in ("source_id", "issuing_organization", "authority", "source_url", "source_type")
            ).lower()
            if text not in haystack:
                continue
        items.append(_source_view(row))
    return sorted(items, key=lambda item: item["source_id"])


def verified_source_for_upload(
    client: Any,
    actor: Actor,
    source_id: str,
    *,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Return a current, permitted source for an operator document upload."""
    del actor
    source = next(
        (row for row in _read(client, sources_table()) if row.get("source_id") == source_id),
        None,
    )
    if source is None:
        raise AdminValidationError("Select a registered source")
    if source.get("verification_status") != "verified":
        raise AdminValidationError("Source must be verified before uploading")
    if source.get("usage_permitted") is not True:
        raise AdminValidationError("Source usage is not permitted")
    if not str(source.get("usage_rights") or "").strip():
        raise AdminValidationError("Source usage rights are missing")
    if source.get("revoked_at"):
        raise AdminValidationError("Source verification has been revoked")

    freshness_days = source.get("freshness_days")
    verified_at = _parse(source.get("last_verified_at"))
    moment = now or _now()
    if (
        not isinstance(freshness_days, int)
        or isinstance(freshness_days, bool)
        or freshness_days <= 0
        or freshness_days > 3650
        or verified_at is None
        or verified_at > moment
    ):
        raise AdminValidationError("Source verification or freshness policy is incomplete")
    if moment - verified_at > timedelta(days=freshness_days):
        raise AdminValidationError("Source verification is stale; verify it again")
    return _source_view(source)


def create_source(
    client: Any,
    actor: Actor,
    payload: Mapping[str, Any],
    *,
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    source_id = str(payload.get("source_id") or "").strip()
    organization = str(payload.get("issuing_organization") or "").strip()
    source_type = str(payload.get("source_type") or "").strip()
    if not source_id or len(source_id) > 120:
        raise AdminValidationError("source_id must be 1-120 characters")
    if not organization:
        raise AdminValidationError("issuing_organization is required")
    if not source_type:
        raise AdminValidationError("source_type is required")
    if any(row.get("source_id") == source_id for row in _read(client, sources_table())):
        raise AdminConflict("Source already exists")

    freshness = payload.get("freshness_days")
    if freshness is not None:
        try:
            freshness = int(freshness)
        except (TypeError, ValueError) as exc:
            raise AdminValidationError("freshness_days must be an integer") from exc
        if freshness <= 0:
            raise AdminValidationError("freshness_days must be positive")

    record = {
        "source_id": source_id,
        "issuing_organization": organization,
        "authority": payload.get("authority"),
        "source_url": payload.get("source_url"),
        "source_type": source_type,
        "verification_status": "unverified",
        "usage_rights": payload.get("usage_rights"),
        "usage_permitted": False,
        "freshness_days": freshness,
        "metadata": payload.get("metadata") or {},
        "created_at": _iso(),
        "updated_at": _iso(),
    }
    _insert(client, sources_table(), record)
    audit(
        client,
        actor,
        action="source.register",
        target_type="source",
        target_id=source_id,
        correlation_id=correlation_id,
        details={"issuing_organization": organization, "source_type": source_type},
    )
    return _source_view(record)


def update_source(
    client: Any,
    actor: Actor,
    source_id: str,
    updates: Mapping[str, Any],
    *,
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    row = next((src for src in _read(client, sources_table()) if src.get("source_id") == source_id), None)
    if row is None:
        raise AdminNotFound("Source not found")
    unknown = set(updates) - SOURCE_FIELDS - {"usage_permitted"}
    if unknown:
        raise AdminValidationError(f"Unsupported source fields: {', '.join(sorted(unknown))}")

    payload: dict[str, Any] = {"updated_at": _iso()}
    if "issuing_organization" in updates:
        organization = str(updates["issuing_organization"] or "").strip()
        if not organization:
            raise AdminValidationError("issuing_organization cannot be empty")
        payload["issuing_organization"] = organization
    for key in ("authority", "source_url", "source_type", "usage_rights"):
        if key in updates:
            value = updates[key]
            payload[key] = str(value).strip() if value else None
    if "usage_permitted" in updates:
        payload["usage_permitted"] = bool(updates["usage_permitted"])
    if "usage_rights" in updates:
        rights = str(updates.get("usage_rights") or "").strip()
        if len(rights) > 500:
            raise AdminValidationError("usage_rights must be at most 500 characters")
        payload["usage_rights"] = rights or None
    effective_rights = payload.get("usage_rights", row.get("usage_rights"))
    effective_usage_permitted = payload.get(
        "usage_permitted", row.get("usage_permitted")
    )
    if (
        row.get("verification_status") == "verified"
        or effective_usage_permitted is True
    ) and not str(effective_rights or "").strip():
        raise AdminValidationError(
            "Usage rights are required when a source is verified or permitted"
        )
    if "freshness_days" in updates:
        value = updates["freshness_days"]
        if value is None:
            payload["freshness_days"] = None
        else:
            try:
                value = int(value)
            except (TypeError, ValueError) as exc:
                raise AdminValidationError("freshness_days must be an integer") from exc
            if value <= 0 or value > 3650:
                raise AdminValidationError("freshness_days must be between 1 and 3650")
            payload["freshness_days"] = value
    if "metadata" in updates:
        payload["metadata"] = updates["metadata"] or {}

    _update(client, sources_table(), "source_id", source_id, payload)
    audit(
        client,
        actor,
        action="source.update",
        target_type="source",
        target_id=source_id,
        correlation_id=correlation_id,
        details={"fields": sorted(payload)},
    )
    merged = {**row, **payload}
    return _source_view(merged)


def verify_source(
    client: Any,
    actor: Actor,
    source_id: str,
    *,
    evidence: str,
    freshness_days: int,
    usage_rights: Optional[str],
    usage_permitted: bool,
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    evidence = (evidence or "").strip()
    if not evidence:
        raise AdminValidationError("Verification evidence is required")
    usage_rights = (usage_rights or "").strip()
    if not usage_rights or len(usage_rights) > 500:
        raise AdminValidationError("Usage rights must contain 1-500 characters")
    if (
        not isinstance(freshness_days, int)
        or isinstance(freshness_days, bool)
        or freshness_days <= 0
        or freshness_days > 3650
    ):
        raise AdminValidationError("freshness_days must be between 1 and 3650")
    if not usage_permitted:
        raise AdminValidationError("usage_permitted must be true before verification")
    row = next((src for src in _read(client, sources_table()) if src.get("source_id") == source_id), None)
    if row is None:
        raise AdminNotFound("Source not found")

    now = _iso()
    metadata = dict(row.get("metadata") or {})
    metadata["verification_evidence"] = evidence
    payload = {
        "verification_status": "verified",
        "verified_by": actor.subject,
        "verified_at": now,
        "last_verified_at": now,
        "freshness_days": freshness_days,
        "usage_rights": usage_rights,
        "usage_permitted": True,
        "revoked_at": None,
        "metadata": metadata,
        "updated_at": now,
    }
    _update(client, sources_table(), "source_id", source_id, payload)
    audit(
        client,
        actor,
        action="source.verify",
        target_type="source",
        target_id=source_id,
        correlation_id=correlation_id,
        details={"freshness_days": freshness_days, "usage_permitted": True},
    )
    return _source_view({**row, **payload})


def revoke_source(
    client: Any,
    actor: Actor,
    source_id: str,
    *,
    reason: str,
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    reason = (reason or "").strip()
    if not reason:
        raise AdminValidationError("A reason is required to revoke a source")
    row = next((src for src in _read(client, sources_table()) if src.get("source_id") == source_id), None)
    if row is None:
        raise AdminNotFound("Source not found")
    payload = {
        "verification_status": "revoked",
        "revoked_at": _iso(),
        "usage_permitted": False,
        "updated_at": _iso(),
    }
    _update(client, sources_table(), "source_id", source_id, payload)
    audit(
        client,
        actor,
        action="source.revoke",
        target_type="source",
        target_id=source_id,
        reason=reason,
        state_from=str(row.get("verification_status")),
        state_to="revoked",
        correlation_id=correlation_id,
    )
    return _source_view({**row, **payload})


# ---------------------------------------------------------------------------
# Review, approval and publication
# ---------------------------------------------------------------------------


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


def review_queue(client: Any, actor: Actor) -> list[dict[str, Any]]:
    del actor
    sources = _source_map(client)
    revisions = _read(client, revisions_table())
    items = []
    for row in _documents(client):
        if row.get("status") != "ready":
            continue
        if row.get("publication_status") not in (None, "draft", "review"):
            continue
        source = sources.get(str(row.get("source_id") or ""))
        revision = _revision_for(row, revisions)
        view = _document_view(row, source=source, revision=revision)
        view["blockers"] = publication_blockers(row, source, revision)
        items.append(view)
    return sorted(items, key=lambda item: item["uploaded_at"], reverse=True)


def _get_raw_document(client: Any, document_id: str) -> dict[str, Any]:
    row = next((doc for doc in _documents(client) if str(doc.get("id")) == document_id), None)
    if row is None:
        raise AdminNotFound("Document not found")
    return row


def _record_event(client: Any, **kwargs: Any) -> bool:
    from utils.publication_store import PublicationStoreUnavailable, record_publication_event

    try:
        return record_publication_event(client, **kwargs)
    except PublicationStoreUnavailable as exc:
        raise AdminUnavailable("Publication event store is unavailable") from exc


def review_document(
    client: Any,
    actor: Actor,
    document_id: str,
    *,
    action: str,
    reason: Optional[str],
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    del correlation_id
    from utils import revision_lifecycle

    try:
        return revision_lifecycle.review_current_document(
            client,
            actor,
            document_id,
            action=action,
            reason=reason,
        )
    except revision_lifecycle.RevisionValidationError as exc:
        raise AdminValidationError(str(exc)) from exc
    except revision_lifecycle.RevisionConflict as exc:
        raise AdminConflict(str(exc)) from exc
    except revision_lifecycle.RevisionNotFound as exc:
        raise AdminNotFound(str(exc)) from exc
    except revision_lifecycle.RevisionUnavailable as exc:
        raise AdminUnavailable(str(exc)) from exc

def publish_document(
    client: Any,
    actor: Actor,
    document_id: str,
    *,
    reason: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    row = _get_raw_document(client, document_id)
    if row.get("publication_status") == "published":
        raise AdminConflict("Document is already published")
    if row.get("publication_status") != "approved":
        raise AdminConflict("Document must be approved before publication")
    source = _source_map(client).get(str(row.get("source_id") or ""))
    revision = _revision_for(row, _read(client, revisions_table()))
    blockers = publication_blockers(row, source, revision)
    if blockers:
        raise AdminValidationError(f"Document is not publishable: {', '.join(blockers)}")

    published_at = _iso()
    payload = {
        "visibility_scope": "public",
        "publication_status": "published",
        "published_at": published_at,
        "owner_type": row.get("owner_type") or "operator",
        "owner_id": row.get("owner_id") or actor.subject,
    }
    prospective = {**row, **payload, "source_type": source.get("source_type"), "current_revision": revision.get("revision")}
    approved_sources = {str(source.get("source_id")): source}
    if not is_publicly_eligible(prospective, approved_sources=approved_sources):
        # Re-run with the same clock used for publication; eligibility also
        # checks approval ordering and freshness.
        raise AdminValidationError("Document fails publication eligibility")

    _update(client, documents_table(), "id", document_id, payload)
    _record_event(
        client,
        document_id=document_id,
        revision=int(revision.get("revision")),
        event_type="publication",
        actor=actor.subject or "",
        idempotency_key=f"publication:{document_id}:{revision.get('revision')}:{uuid.uuid4().hex}",
        details={"reason": reason} if reason else {},
    )
    audit(
        client,
        actor,
        action="document.publish",
        target_type="document",
        target_id=document_id,
        reason=reason,
        state_from=str(row.get("publication_status")),
        state_to="published",
        correlation_id=correlation_id,
        details={"revision": revision.get("revision")},
    )
    return get_document(client, actor, document_id)


def lifecycle_action(
    client: Any,
    actor: Actor,
    document_id: str,
    *,
    action: str,
    reason: Optional[str],
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    if action not in {"suspend", "withdraw"}:
        raise AdminValidationError("Unsupported lifecycle action")
    reason = (reason or "").strip()
    if not reason:
        raise AdminValidationError("A reason is required")
    row = _get_raw_document(client, document_id)
    current = row.get("publication_status")
    if action == "suspend" and current not in {"published", "approved"}:
        raise AdminConflict("Only approved or published documents can be suspended")
    if action == "withdraw" and current in {None, "draft"}:
        raise AdminConflict("Document has no approval or publication to withdraw")

    new_status = "suspended" if action == "suspend" else "archived"
    _update(client, documents_table(), "id", document_id, {"publication_status": new_status})
    _record_event(
        client,
        document_id=document_id,
        revision=int(row.get("current_revision") or row.get("document_version") or 1),
        event_type="suspension" if action == "suspend" else "withdrawal",
        actor=actor.subject or "",
        idempotency_key=f"{action}:{document_id}:{row.get('current_revision') or row.get('document_version') or 1}:{uuid.uuid4().hex}",
        details={"reason": reason},
    )
    audit(
        client,
        actor,
        action=f"document.{action}",
        target_type="document",
        target_id=document_id,
        reason=reason,
        state_from=str(current),
        state_to=new_status,
        correlation_id=correlation_id,
    )
    return get_document(client, actor, document_id)


def list_revisions(client: Any, actor: Actor, document_id: str) -> list[dict[str, Any]]:
    del actor
    row = _get_raw_document(client, document_id)
    revisions = [
        rev for rev in _read(client, revisions_table()) if rev.get("document_id") == document_id
    ]
    current = row.get("current_revision") or row.get("document_version")
    items = []
    for rev in sorted(revisions, key=lambda item: int(item.get("revision") or 0), reverse=True):
        view = _revision_view(rev)
        view["is_current"] = rev.get("revision") == current
        items.append(view)
    return items


# ---------------------------------------------------------------------------
# Audit, roles and status
# ---------------------------------------------------------------------------


def _audit_view(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "actor_id": row.get("actor_id"),
        "actor_role": row.get("actor_role"),
        "action": row.get("action"),
        "target_type": row.get("target_type"),
        "target_id": row.get("target_id"),
        "reason": row.get("reason"),
        "state_from": row.get("state_from"),
        "state_to": row.get("state_to"),
        "correlation_id": row.get("correlation_id"),
        "details": row.get("details") or {},
        "created_at": row.get("created_at"),
    }


def list_audit_logs(
    client: Any,
    actor: Actor,
    *,
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    target_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    del actor
    rows = sorted(
        _read(client, AUDIT_TABLE),
        key=lambda row: str(row.get("created_at") or ""),
        reverse=True,
    )
    if action:
        rows = [row for row in rows if str(row.get("action", "")).startswith(action)]
    if actor_id:
        rows = [row for row in rows if row.get("actor_id") == actor_id]
    if target_id:
        rows = [row for row in rows if str(row.get("target_id")) == target_id]
    total = len(rows)
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    start = (page - 1) * page_size
    return {
        "items": [_audit_view(row) for row in rows[start : start + page_size]],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def list_roles(client: Any, actor: Actor) -> dict[str, Any]:
    del actor
    rows = sorted(_read(client, ROLES_TABLE), key=lambda row: str(row.get("granted_at") or ""), reverse=True)
    return {
        "roles": [
            {
                "id": row.get("id"),
                "actor_id": row.get("email"),
                "role": row.get("role"),
                "granted_by": row.get("granted_by"),
                "granted_at": row.get("granted_at"),
                "revoked_at": row.get("revoked_at"),
                "revoked_by": row.get("revoked_by"),
                "reason": row.get("reason"),
            }
            for row in rows
        ],
        "available_roles": list(KNOWN_ROLES),
        "role_permissions": {role: sorted(perms) for role, perms in ROLE_PERMISSIONS.items()},
    }


def grant_role(
    client: Any,
    actor: Actor,
    *,
    target_actor_id: str,
    role: str,
    reason: Optional[str],
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    target_actor_id = (target_actor_id or "").strip().lower()
    if not target_actor_id:
        raise AdminValidationError("target actor id is required")
    if actor.email and target_actor_id == actor.email.strip().lower():
        raise AdminValidationError("Self-promotion is not allowed")
    if "@" not in target_actor_id:
        raise AdminValidationError("A valid email address is required")
    if role not in KNOWN_ROLES:
        raise AdminValidationError("Unknown role")
    active = [
        row
        for row in _read(client, ROLES_TABLE)
        if row.get("email") == target_actor_id and row.get("role") == role and not row.get("revoked_at")
    ]
    if active:
        raise AdminConflict("Role is already active for this actor")
    record = {
        "email": target_actor_id,
        "role": role,
        "granted_by": actor.subject,
        "granted_at": _iso(),
        "reason": reason,
    }
    created = _insert(client, ROLES_TABLE, record)
    audit(
        client,
        actor,
        action="role.grant",
        target_type="actor",
        target_id=target_actor_id,
        reason=reason,
        state_to=role,
        correlation_id=correlation_id,
    )
    return created


def revoke_role(
    client: Any,
    actor: Actor,
    *,
    target_actor_id: str,
    role: str,
    reason: str,
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    target_actor_id = (target_actor_id or "").strip().lower()
    reason = (reason or "").strip()
    if not reason:
        raise AdminValidationError("A reason is required")
    if actor.email and target_actor_id == actor.email.strip().lower():
        raise AdminValidationError("You cannot revoke your own role")
    active = [
        row
        for row in _read(client, ROLES_TABLE)
        if row.get("email") == target_actor_id and row.get("role") == role and not row.get("revoked_at")
    ]
    if not active:
        raise AdminNotFound("Active role assignment not found")
    _update(
        client,
        ROLES_TABLE,
        "id",
        str(active[0].get("id")),
        {"revoked_at": _iso(), "revoked_by": actor.subject, "reason": reason},
    )
    audit(
        client,
        actor,
        action="role.revoke",
        target_type="actor",
        target_id=target_actor_id,
        reason=reason,
        state_from=role,
        correlation_id=correlation_id,
    )
    return {**active[0], "revoked_at": _iso(), "revoked_by": actor.subject, "reason": reason}


def system_status(client: Any, actor: Actor) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    for name, table in (
        ("documents", documents_table()),
        ("sources", sources_table()),
        ("revisions", revisions_table()),
        ("publication_events", events_table()),
        ("audit_log", AUDIT_TABLE),
        ("roles", ROLES_TABLE),
    ):
        try:
            _read(client, table)
            checks[name] = "ok"
        except AdminUnavailable:
            checks[name] = "unavailable"
    audit(
        client,
        actor,
        action="admin.status_view",
        target_type="system",
        target_id="status",
    )
    return {
        "generated_at": _iso(),
        "checks": checks,
        "role_provider": "ok" if checks.get("roles") == "ok" else "unavailable",
        "environment": "configured",
    }
