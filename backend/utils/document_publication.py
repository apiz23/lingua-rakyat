"""Pure, fail-closed policy for public document eligibility.

This module deliberately performs no database or provider access. Callers must
resolve source_id against an authoritative, currently approved source registry
and pass the resulting source-id to source-type mapping. An empty mapping denies
every document.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import Any, Union, Mapping as MappingType


_PUBLIC_SCOPE = "public"
_PUBLISHED_STATUS = "published"
_PROCESSING_READY = "ready"
_ALLOWED_OWNERS = {"system", "operator", "telegram_chat"}
_VERIFIED_SOURCE = "verified"

# A registry entry may be a bare source-type string (legacy callers and the
# original unit tests) or a full trusted-source record. Only the full record
# can carry verification, rights and freshness, and the central eligibility
# service always supplies it.
SourceRegistryValue = Union[str, MappingType[str, Any]]


def _parse_aware_datetime(value: Any) -> datetime | None:
    """Parse an ISO timestamp, rejecting missing, malformed, and naive values."""
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(timezone.utc)


def _source_entry_allows_public_use(
    entry: SourceRegistryValue, source_type: str, current_time: datetime
) -> bool:
    """Validate one trusted-source registry entry.

    A bare string entry preserves the original predicate contract (source type
    match only). The central service never uses that form: it always passes a
    full record so verification, rights and freshness are enforced.
    """
    if isinstance(entry, str):
        return entry.strip() == source_type
    if not isinstance(entry, Mapping):
        return False

    if entry.get("source_type") != source_type:
        return False
    if entry.get("verification_status") != _VERIFIED_SOURCE:
        return False
    if entry.get("usage_permitted") is not True:
        return False
    if entry.get("revoked_at"):
        return False

    freshness_days = entry.get("freshness_days")
    if isinstance(freshness_days, bool) or not isinstance(freshness_days, int):
        return False
    if freshness_days <= 0:
        return False

    verified_at = _parse_aware_datetime(entry.get("last_verified_at"))
    if verified_at is None or verified_at > current_time:
        return False
    if current_time - verified_at > timedelta(days=freshness_days):
        return False
    return True


def is_publicly_eligible(
    document: Mapping[str, Any] | None,
    *,
    approved_sources: Mapping[str, SourceRegistryValue] | None = None,
    now: datetime | None = None,
) -> bool:
    """Return whether a document is explicitly eligible for public access.

    The caller supplies a trusted mapping of approved source IDs to source
    records (or, for backwards compatibility, to a bare source type). No
    source is considered approved by default. Full records must be verified,
    permit usage, carry a positive freshness window and not be revoked.
    """
    if not isinstance(document, Mapping) or not approved_sources:
        return False

    if now is None:
        current_time = datetime.now(timezone.utc)
    else:
        if now.tzinfo is None or now.utcoffset() is None:
            return False
        current_time = now.astimezone(timezone.utc)

    if document.get("visibility_scope") != _PUBLIC_SCOPE:
        return False
    if document.get("publication_status") != _PUBLISHED_STATUS:
        return False
    if document.get("status") != _PROCESSING_READY:
        return False

    source_id = document.get("source_id")
    source_type = document.get("source_type")
    if not isinstance(source_id, str) or not source_id.strip():
        return False
    if not isinstance(source_type, str) or not source_type.strip():
        return False
    registry_entry = approved_sources.get(source_id.strip())
    if registry_entry is None:
        return False
    if not _source_entry_allows_public_use(registry_entry, source_type.strip(), current_time):
        return False

    owner_type = document.get("owner_type")
    if not isinstance(owner_type, str) or owner_type not in _ALLOWED_OWNERS:
        return False
    if owner_type == "telegram_chat":
        owner_id = document.get("owner_id")
        if not isinstance(owner_id, str) or not owner_id.strip():
            return False

    approved_by = document.get("approved_by")
    if not isinstance(approved_by, str) or not approved_by.strip():
        return False

    approved_at = _parse_aware_datetime(document.get("approved_at"))
    published_at = _parse_aware_datetime(document.get("published_at"))
    last_verified_at = _parse_aware_datetime(document.get("last_verified_at"))
    if approved_at is None or published_at is None or last_verified_at is None:
        return False
    if approved_at > published_at or published_at > current_time:
        return False
    if last_verified_at > current_time:
        return False

    expires_at_value = document.get("expires_at")
    if expires_at_value is not None:
        expires_at = _parse_aware_datetime(expires_at_value)
        if expires_at is None or current_time >= expires_at:
            return False

    version = document.get("current_revision", document.get("document_version"))
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        return False

    # These markers are optional in older rows, but any populated marker means
    # this revision is not currently eligible regardless of other fields.
    if document.get("superseded_by") or document.get("revoked_at"):
        return False

    return True
