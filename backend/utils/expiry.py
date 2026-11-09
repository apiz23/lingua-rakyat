"""Server-side expiry sweeper.

Eligibility already denies expired documents at read time; this sweeper keeps
the stored lifecycle consistent and appends exactly one expiration event. It is
invoked by a trusted operator/scheduler, never by an unauthenticated HTTP
endpoint. Every step is safe to retry.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from utils.publication_store import (
    PublicationStoreUnavailable,
    expire_document,
    fetch_documents,
)

logger = logging.getLogger("expiry")


def parse_timestamp(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        normalized = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(timezone.utc)


def find_expired_documents(
    rows: list[dict[str, Any]], *, now: Optional[datetime] = None
) -> list[dict[str, Any]]:
    moment = now or datetime.now(timezone.utc)
    expired: list[dict[str, Any]] = []
    for row in rows:
        if row.get("publication_status") != "published":
            continue
        expires_at = parse_timestamp(row.get("expires_at"))
        if expires_at is not None and expires_at <= moment:
            expired.append(row)
    return expired


def run_expiry(
    client: Any, *, now: Optional[datetime] = None, actor: str = "system:expiry"
) -> dict[str, int]:
    """Expire due documents. Returns counts; raises on store unavailability."""
    moment = now or datetime.now(timezone.utc)
    try:
        rows = fetch_documents(client)
    except PublicationStoreUnavailable:
        raise

    expired = find_expired_documents(rows, now=moment)
    changed = 0
    for row in expired:
        if expire_document(client, row, actor=actor, now=moment):
            changed += 1
    logger.info("[Expiry] due=%d newly_expired=%d", len(expired), changed)
    return {"due": len(expired), "expired": changed}
