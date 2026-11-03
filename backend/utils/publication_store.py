"""Trusted persistence adapters for the publication lifecycle.

The store is intentionally small and explicit. It never decides eligibility and
never trusts caller-supplied ids; callers must already hold verified identity
and an approved operation. Every read failure raises
:class:`PublicationStoreUnavailable` so eligibility fails closed instead of
silently treating a registry outage as "no restrictions".
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

logger = logging.getLogger("publication_store")


class PublicationStoreUnavailable(RuntimeError):
    """The authoritative publication store could not be read or written."""


class PublicationSchemaMissing(PublicationStoreUnavailable):
    """A publication table does not exist in this database yet.

    This is a deployment state, not a transient outage. Trusted-source and
    revision reads degrade to "no approved rows" so the public catalogue is
    empty (deny) instead of reporting the whole document service as down.
    """


def documents_table() -> str:
    return os.getenv("DOCUMENTS_TABLE", "lr_documents")


def sources_table() -> str:
    return os.getenv("OFFICIAL_SOURCES_TABLE", "official_sources")


def revisions_table() -> str:
    return os.getenv("DOCUMENT_REVISIONS_TABLE", "document_revisions")


def events_table() -> str:
    return os.getenv("PUBLICATION_EVENTS_TABLE", "publication_events")


def _is_missing_table(exc: Exception) -> bool:
    text = str(exc)
    return (
        "42P01" in text
        or "PGRST205" in text
        or ('relation "public.' in text and "does not exist" in text)
    )


def _rows(client: Any, table: str) -> list[dict[str, Any]]:
    try:
        result = client.table(table).select("*").execute()
    except Exception as exc:  # provider/network errors are availability failures
        if _is_missing_table(exc):
            logger.error(
                "[Publication] Required table %s is missing. Apply the publication "
                "migration; the public catalogue stays empty (deny) until then.",
                table,
            )
            raise PublicationSchemaMissing(f"Missing table {table}") from exc
        raise PublicationStoreUnavailable(f"Could not read {table}") from exc
    data = getattr(result, "data", None) or []
    return [row for row in data if isinstance(row, dict)]


def fetch_approved_sources(client: Any) -> dict[str, dict[str, Any]]:
    """Return verified, usage-permitted, unrevoked sources keyed by source id."""
    try:
        rows = _rows(client, sources_table())
    except PublicationSchemaMissing:
        # No registry means no approved source, so everything denies.
        return {}
    registry: dict[str, dict[str, Any]] = {}
    for row in rows:
        source_id = row.get("source_id")
        if not isinstance(source_id, str) or not source_id.strip():
            continue
        if row.get("verification_status") != "verified":
            continue
        if row.get("usage_permitted") is not True:
            continue
        if row.get("revoked_at"):
            continue
        registry[source_id.strip()] = row
    return registry


def fetch_documents(
    client: Any, document_ids: Optional[Iterable[str]] = None
) -> list[dict[str, Any]]:
    rows = _rows(client, documents_table())
    if document_ids is None:
        return rows
    wanted = {doc_id for doc_id in document_ids if isinstance(doc_id, str) and doc_id}
    return [row for row in rows if str(row.get("id", "")) in wanted]


def fetch_revisions(
    client: Any, document_ids: Optional[Iterable[str]] = None
) -> list[dict[str, Any]]:
    try:
        rows = _rows(client, revisions_table())
    except PublicationSchemaMissing:
        # Without revision records no document has a current approved revision.
        return []
    if document_ids is None:
        return rows
    wanted = {doc_id for doc_id in document_ids if isinstance(doc_id, str) and doc_id}
    return [row for row in rows if str(row.get("document_id", "")) in wanted]


def _event_exists(client: Any, idempotency_key: str) -> bool:
    try:
        result = (
            client.table(events_table())
            .select("id")
            .eq("idempotency_key", idempotency_key)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise PublicationStoreUnavailable("Could not read publication events") from exc
    data = getattr(result, "data", None) or []
    return bool(data)


def record_publication_event(
    client: Any,
    *,
    document_id: str,
    revision: Optional[int],
    event_type: str,
    actor: str,
    occurred_at: Optional[datetime] = None,
    idempotency_key: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> bool:
    """Append one publication event. Returns False when it was already recorded.

    Events are append-only: this adapter never updates or deletes them.
    """
    if not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id is required")
    if not isinstance(actor, str) or not actor.strip():
        raise ValueError("actor is required")
    if event_type not in {
        "approval",
        "publication",
        "suspension",
        "expiration",
        "withdrawal",
    }:
        raise ValueError("unsupported publication event type")

    key = idempotency_key or f"{event_type}:{document_id}:{revision}:{actor}"
    if _event_exists(client, key):
        return False

    payload = {
        "document_id": document_id,
        "revision": revision,
        "event_type": event_type,
        "actor": actor,
        "occurred_at": (occurred_at or datetime.now(timezone.utc)).isoformat(),
        "idempotency_key": key,
        "details": details or {},
    }
    try:
        client.table(events_table()).insert(payload).execute()
    except Exception as exc:
        # A concurrent retry may have won the unique key. Treat that as already
        # recorded only when the store says so; anything else is an outage.
        if _is_duplicate_key(exc):
            return False
        raise PublicationStoreUnavailable("Could not append publication event") from exc
    return True


def _is_duplicate_key(exc: Exception) -> bool:
    text = str(exc).lower()
    return "23505" in text or "duplicate key" in text or "unique constraint" in text


def expiration_idempotency_key(document_id: str, revision: Optional[int]) -> str:
    return f"expiration:{document_id}:{revision}"


def expire_document(
    client: Any,
    document: dict[str, Any],
    *,
    actor: str = "system:expiry",
    now: Optional[datetime] = None,
) -> bool:
    """Expire one published document and record the event exactly once.

    Safe to retry: the event key makes duplicate runs a no-op. The status
    update is conditional on the row still being published.
    """
    document_id = str(document.get("id", "")).strip()
    if not document_id:
        raise ValueError("document id is required")
    revision = document.get("current_revision", document.get("document_version"))
    revision_value = revision if isinstance(revision, int) and not isinstance(revision, bool) else None

    key = expiration_idempotency_key(document_id, revision_value)
    if _event_exists(client, key):
        return False

    moment = now or datetime.now(timezone.utc)
    try:
        (
            client.table(documents_table())
            .update(
                {
                    "publication_status": "expired",
                    "expires_at": document.get("expires_at"),
                }
            )
            .eq("id", document_id)
            .eq("publication_status", "published")
            .execute()
        )
    except Exception as exc:
        raise PublicationStoreUnavailable("Could not expire document") from exc

    record_publication_event(
        client,
        document_id=document_id,
        revision=revision_value,
        event_type="expiration",
        actor=actor,
        occurred_at=moment,
        idempotency_key=key,
        details={"expires_at": document.get("expires_at")},
    )
    return True
