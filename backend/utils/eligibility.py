"""The single authoritative document-eligibility service.

Routers must not re-implement publication rules. They call this service for the
catalogue, direct document reads, PDF bytes, shares, retrieval/citation output
and answer caching. Any missing registry, revision, source or approval value
denies access.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Optional

from fastapi import HTTPException

from utils.authorization import Actor, ActorKind
from utils.document_publication import _parse_aware_datetime, is_publicly_eligible
from utils.publication_store import (
    PublicationStoreUnavailable,
    fetch_approved_sources,
    fetch_documents,
    fetch_revisions,
)

logger = logging.getLogger("eligibility")

# Owner kinds whose rows may be read by the verified owner even when private.
_CITIZEN_OWNER_TYPES = {"citizen", "user"}

# Temporary, explicitly opt-in compatibility switch for documents uploaded
# before the publication model existed. Default is off. Enabling it lets
# unclassified/draft rows be served exactly as the old catalogue did, which
# bypasses trusted-source verification and human approval. Use only to recover
# a local/demo library while the migration and approvals are completed.
_LEGACY_FLAG = "ALLOW_LEGACY_PUBLIC_DOCUMENTS"


def legacy_public_documents_allowed() -> bool:
    return (os.getenv(_LEGACY_FLAG, "false") or "").strip().lower() == "true"


class EligibilityUnavailable(RuntimeError):
    """The authoritative eligibility inputs cannot be read right now."""


@dataclass(frozen=True)
class EligibilitySnapshot:
    """Immutable view of the trusted sources and revisions for one request."""

    approved_sources: Mapping[str, Mapping[str, Any]]
    revisions_by_document: Mapping[str, tuple[Mapping[str, Any], ...]]


def is_legacy_public_document(
    document: Mapping[str, Any] | None,
    *,
    now: Optional[datetime] = None,
) -> bool:
    """Old-catalogue eligibility, only when the operator opts in.

    Matches rows that predate publication metadata: an unclassified/draft,
    ready document with no approval or source markers, not revoked or expired.
    Anything explicitly private or partially approved is never eligible here.
    """
    if not isinstance(document, Mapping):
        return False
    if not legacy_public_documents_allowed():
        return False
    if document.get("status") != "ready":
        return False
    if document.get("visibility_scope") not in (None, "unclassified"):
        return False
    if document.get("publication_status") not in (None, "draft"):
        return False
    if document.get("source_id") or document.get("approved_by") or document.get("published_at"):
        return False
    if document.get("revoked_at") or document.get("superseded_by"):
        return False

    current_time = now or datetime.now(timezone.utc)
    expires_at = _parse_aware_datetime(document.get("expires_at"))
    if document.get("expires_at") is not None:
        if expires_at is None or current_time >= expires_at:
            return False
    return True


def revision_number(document: Mapping[str, Any]) -> Optional[int]:
    value = document.get("current_revision", document.get("document_version"))
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        return None
    return value


def load_snapshot(
    client: Any, document_ids: Optional[Iterable[str]] = None
) -> EligibilitySnapshot:
    """Read registry and revision state. Raises ``EligibilityUnavailable``."""
    try:
        sources = fetch_approved_sources(client)
        revisions = fetch_revisions(client, document_ids)
    except PublicationStoreUnavailable as exc:
        raise EligibilityUnavailable(str(exc)) from exc

    by_document: dict[str, list[Mapping[str, Any]]] = {}
    for revision in revisions:
        document_id = str(revision.get("document_id", "")).strip()
        if document_id:
            by_document.setdefault(document_id, []).append(revision)
    return EligibilitySnapshot(
        approved_sources=sources,
        revisions_by_document={key: tuple(value) for key, value in by_document.items()},
    )


def snapshot_for_rows(client: Any, rows: Iterable[Mapping[str, Any]]) -> EligibilitySnapshot:
    ids = [str(row.get("id", "")) for row in rows if row.get("id") is not None]
    return load_snapshot(client, ids)


def current_approved_revision(
    document: Mapping[str, Any],
    snapshot: EligibilitySnapshot,
) -> Optional[Mapping[str, Any]]:
    """Resolve exactly one current approved revision, or None."""
    document_id = str(document.get("id", "")).strip()
    number = revision_number(document)
    if not document_id or number is None:
        return None
    candidates = [
        revision
        for revision in snapshot.revisions_by_document.get(document_id, ())
        if revision.get("revision") == number
    ]
    if len(candidates) != 1:
        return None
    revision = candidates[0]
    if revision.get("superseded_at") or revision.get("revoked_at"):
        return None
    if not isinstance(revision.get("storage_path"), str) or not revision["storage_path"].strip():
        return None
    if not isinstance(revision.get("approved_by"), str) or not revision["approved_by"].strip():
        return None
    if revision.get("approved_at") is None:
        return None
    return revision


def is_document_public(
    document: Mapping[str, Any] | None,
    snapshot: EligibilitySnapshot,
    *,
    now: Optional[datetime] = None,
) -> bool:
    """Public eligibility for one catalogue row, fail closed."""
    if not isinstance(document, Mapping):
        return False
    if is_legacy_public_document(document, now=now):
        return True
    if current_approved_revision(document, snapshot) is None:
        return False
    return is_publicly_eligible(
        document,
        approved_sources=snapshot.approved_sources,
        now=now,
    )


def filter_public_rows(
    rows: Iterable[Mapping[str, Any]],
    snapshot: EligibilitySnapshot,
    *,
    now: Optional[datetime] = None,
) -> list[Mapping[str, Any]]:
    return [row for row in rows if is_document_public(row, snapshot, now=now)]


def public_pdf_storage_path(
    document: Mapping[str, Any],
    snapshot: EligibilitySnapshot,
    *,
    now: Optional[datetime] = None,
) -> Optional[str]:
    """Return the current approved revision's storage path, never a stale one."""
    if not is_document_public(document, snapshot, now=now):
        return None
    revision = current_approved_revision(document, snapshot)
    if revision is not None:
        return str(revision["storage_path"]).strip()
    if is_legacy_public_document(document, now=now):
        storage_path = document.get("storage_path")
        if isinstance(storage_path, str) and storage_path.strip():
            return storage_path.strip()
    return None


def _citizen_owns(document: Mapping[str, Any], actor: Actor) -> bool:
    if actor.kind is not ActorKind.CITIZEN:
        return False
    owner_id = document.get("owner_id")
    if not isinstance(owner_id, str) or not owner_id.strip():
        return False
    if document.get("owner_type") not in _CITIZEN_OWNER_TYPES:
        return False
    return actor.subject is not None and owner_id.strip() == actor.subject


def authorize_document_rows(
    actor: Actor,
    rows_by_id: Mapping[str, Mapping[str, Any]],
    snapshot: EligibilitySnapshot,
    *,
    now: Optional[datetime] = None,
    requested_ids: Optional[Iterable[str]] = None,
) -> dict[str, Mapping[str, Any]]:
    """Return the readable subset, denying the whole request on any gap.

    A row is readable when it is publicly eligible or owned by the verified
    citizen. Missing rows, anonymous ownership claims and unknown states are
    denied with 404 so callers cannot probe existence.
    """
    wanted = (
        [str(doc_id) for doc_id in requested_ids if isinstance(doc_id, str) and doc_id]
        if requested_ids is not None
        else [str(doc_id) for doc_id in rows_by_id]
    )
    allowed: dict[str, Mapping[str, Any]] = {}
    for document_id in wanted:
        row = rows_by_id.get(document_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Document not found")
        if is_document_public(row, snapshot, now=now) or _citizen_owns(row, actor):
            allowed[document_id] = row
            continue
        raise HTTPException(status_code=404, detail="Document not found")
    return allowed


def load_documents_for_authorization(
    client: Any, document_ids: Iterable[str]
) -> tuple[dict[str, Mapping[str, Any]], EligibilitySnapshot]:
    try:
        rows = fetch_documents(client, document_ids)
    except PublicationStoreUnavailable as exc:
        raise EligibilityUnavailable(str(exc)) from exc
    by_id = {str(row.get("id", "")): row for row in rows if row.get("id") is not None}
    return by_id, load_snapshot(client, document_ids)


def dataset_for_public_catalogue(
    client: Any,
) -> tuple[list[Mapping[str, Any]], EligibilitySnapshot]:
    try:
        rows = fetch_documents(client)
    except PublicationStoreUnavailable as exc:
        raise EligibilityUnavailable(str(exc)) from exc
    snapshot = load_snapshot(client, [str(row.get("id", "")) for row in rows])
    return rows, snapshot
