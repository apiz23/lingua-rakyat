"""Central eligibility service: registry, revision, freshness and ownership."""

import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils import eligibility
from utils.authorization import Actor, ActorKind
from utils.publication_store import (
    PublicationStoreUnavailable,
    expire_document,
    expiration_idempotency_key,
    record_publication_event,
)

NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)
RECENT = (NOW - timedelta(days=1)).isoformat()
OLDER = (NOW - timedelta(days=10)).isoformat()
FUTURE = (NOW + timedelta(days=1)).isoformat()


@pytest.fixture(autouse=True)
def _legacy_override_off(monkeypatch):
    """Denial tests must not inherit the local owner override from .env."""
    monkeypatch.delenv("ALLOW_LEGACY_PUBLIC_DOCUMENTS", raising=False)


class Query:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self._rows = [row for row in self._rows if str(row.get(field)) == str(value)]
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=list(self._rows))

    def insert(self, payload):
        self._rows.append(dict(payload))
        return self

    def update(self, payload):
        for row in self._rows:
            row.update(payload)
        return self


class Client:
    def __init__(self, sources=None, documents=None, revisions=None, events=None, fail=None):
        self.tables = {
            "official_sources": list(sources or []),
            "lr_documents": list(documents or []),
            "document_revisions": list(revisions or []),
            "publication_events": list(events or []),
        }
        self.fail = fail or set()

    def table(self, name):
        if name in self.fail:
            raise RuntimeError(f"{name} unavailable")
        return Query(self.tables.setdefault(name, []))


def source(**overrides):
    row = {
        "source_id": "src-1",
        "source_type": "official_gov",
        "verification_status": "verified",
        "usage_permitted": True,
        "usage_rights": "Public information with attribution.",
        "freshness_days": 30,
        "last_verified_at": RECENT,
        "revoked_at": None,
    }
    row.update(overrides)
    return row


def document(**overrides):
    row = {
        "id": "doc-1",
        "name": "Doc",
        "status": "ready",
        "visibility_scope": "public",
        "publication_status": "published",
        "source_id": "src-1",
        "source_type": "official_gov",
        "owner_type": "operator",
        "owner_id": "operator-1",
        "approved_by": "operator-1",
        "approved_at": "2026-11-01T10:00:00+00:00",
        "published_at": "2026-11-01T11:00:00+00:00",
        "last_verified_at": RECENT,
        "expires_at": None,
        "current_revision": 1,
    }
    row.update(overrides)
    return row


def revision(**overrides):
    row = {
        "document_id": "doc-1",
        "revision": 1,
        "storage_path": "doc-1/revision-1.pdf",
        "approved_by": "operator-1",
        "approved_at": "2026-11-01T10:00:00+00:00",
        "superseded_at": None,
        "revoked_at": None,
    }
    row.update(overrides)
    return row


def snapshot(client):
    return eligibility.load_snapshot(client)


def test_fully_approved_document_is_public():
    client = Client(sources=[source()], documents=[document()], revisions=[revision()])
    assert eligibility.is_document_public(document(), snapshot(client), now=NOW)


@pytest.mark.parametrize(
    "doc",
    [
        {"id": "legacy", "name": "Legacy", "status": "ready"},
        document(visibility_scope="unclassified"),
        document(publication_status="draft"),
        document(status="processing"),
        document(expires_at=(NOW - timedelta(seconds=1)).isoformat()),
        document(expires_at="not-a-date"),
        document(source_id="unknown"),
        document(approved_by=""),
        document(published_at=FUTURE),
        document(last_verified_at=FUTURE),
    ],
)
def test_legacy_or_incomplete_documents_are_never_public(doc):
    client = Client(sources=[source()], documents=[doc], revisions=[revision()])
    assert not eligibility.is_document_public(doc, snapshot(client), now=NOW)


@pytest.mark.parametrize(
    "entry",
    [
        source(verification_status="pending"),
        source(verification_status="unverified"),
        source(usage_permitted=False),
        source(usage_rights=" "),
        source(freshness_days=None),
        source(freshness_days=0),
        source(freshness_days=3651),
        source(freshness_days="30"),
        source(last_verified_at=None),
        source(last_verified_at=FUTURE),
        source(revoked_at="2026-10-01T00:00:00Z"),
        source(source_type="other_type"),
    ],
)
def test_untrusted_source_records_deny_public_access(entry):
    client = Client(sources=[entry], documents=[document()], revisions=[revision()])
    assert not eligibility.is_document_public(document(), snapshot(client), now=NOW)


def test_stale_source_freshness_denies_public_access():
    stale = (NOW - timedelta(days=31)).isoformat()
    client = Client(
        sources=[source(last_verified_at=stale)], documents=[document()], revisions=[revision()]
    )
    assert not eligibility.is_document_public(document(), snapshot(client), now=NOW)


@pytest.mark.parametrize(
    "rev",
    [
        revision(revision=2),
        revision(superseded_at="2026-11-02T00:00:00Z"),
        revision(revoked_at="2026-11-02T00:00:00Z"),
        revision(storage_path=None),
        revision(storage_path=" "),
        revision(approved_by=""),
        revision(approved_at=None),
    ],
)
def test_revision_integrity_is_required(rev):
    client = Client(sources=[source()], documents=[document()], revisions=[rev])
    assert not eligibility.is_document_public(document(), snapshot(client), now=NOW)


def test_pdf_uses_current_approved_revision_storage_path():
    client = Client(
        sources=[source()],
        documents=[document(current_revision=2)],
        revisions=[
            revision(revision=1, storage_path="doc-1/old.pdf", superseded_at="2026-11-02T00:00:00Z"),
            revision(revision=2, storage_path="doc-1/new.pdf"),
        ],
    )
    snap = snapshot(client)
    assert eligibility.public_pdf_storage_path(document(current_revision=2), snap, now=NOW) == "doc-1/new.pdf"


def test_registry_outage_fails_closed():
    client = Client(sources=[source()], documents=[document()], revisions=[revision()], fail={"official_sources"})
    with pytest.raises(eligibility.EligibilityUnavailable):
        snapshot(client)


class MissingPublicationTables(Client):
    def table(self, name):
        if name in {"official_sources", "document_revisions"}:
            raise Exception(f'Error 42P01: relation "public.{name}" does not exist')
        return super().table(name)


def test_missing_registry_tables_degrade_to_no_approved_rows():
    # An unapplied migration is a deployment state, not an outage: the
    # catalogue must return an empty (deny) result, not a 503.
    client = MissingPublicationTables(documents=[document()])
    snap = snapshot(client)
    assert snap.approved_sources == {}
    assert snap.revisions_by_document == {}
    assert not eligibility.is_document_public(document(), snap, now=NOW)


def _legacy_document(**overrides):
    row = {
        "id": "legacy-doc",
        "name": "Old upload.pdf",
        "status": "ready",
        "visibility_scope": "unclassified",
        "publication_status": "draft",
        "storage_path": "legacy-doc/file.pdf",
        "expires_at": None,
    }
    row.update(overrides)
    return row


def test_legacy_compatibility_is_off_by_default(monkeypatch):
    monkeypatch.delenv("ALLOW_LEGACY_PUBLIC_DOCUMENTS", raising=False)
    snap = eligibility.EligibilitySnapshot(approved_sources={}, revisions_by_document={})
    assert not eligibility.is_document_public(_legacy_document(), snap, now=NOW)
    assert eligibility.public_pdf_storage_path(_legacy_document(), snap, now=NOW) is None


def test_legacy_compatibility_serves_old_ready_uploads_when_opted_in(monkeypatch):
    monkeypatch.setenv("ALLOW_LEGACY_PUBLIC_DOCUMENTS", "true")
    snap = eligibility.EligibilitySnapshot(approved_sources={}, revisions_by_document={})
    doc = _legacy_document()
    assert eligibility.is_document_public(doc, snap, now=NOW)
    assert eligibility.public_pdf_storage_path(doc, snap, now=NOW) == "legacy-doc/file.pdf"


@pytest.mark.parametrize(
    "row",
    [
        _legacy_document(visibility_scope="private"),
        _legacy_document(publication_status="published", approved_by="operator-1"),
        _legacy_document(status="processing"),
        _legacy_document(revoked_at="2026-11-01T00:00:00Z"),
        _legacy_document(expires_at="2026-11-02T00:00:00Z"),
        _legacy_document(approved_by="operator-1"),
        _legacy_document(source_id="src-1"),
        _legacy_document(published_at="2026-11-01T00:00:00Z"),
        _legacy_document(storage_path=None),
    ],
)
def test_legacy_compatibility_never_widens_explicit_or_broken_rows(monkeypatch, row):
    monkeypatch.setenv("ALLOW_LEGACY_PUBLIC_DOCUMENTS", "true")
    snap = eligibility.EligibilitySnapshot(approved_sources={}, revisions_by_document={})
    if row.get("storage_path") is None:
        # Catalogue eligibility still matches old behaviour; the PDF path is absent.
        assert eligibility.is_document_public(row, snap, now=NOW)
        assert eligibility.public_pdf_storage_path(row, snap, now=NOW) is None
    else:
        assert not eligibility.is_document_public(row, snap, now=NOW)


def test_public_catalogue_filters_ineligible_rows():
    good = document()
    draft = document(id="doc-2", publication_status="draft")
    client = Client(sources=[source()], documents=[good, draft], revisions=[revision()])
    snap = snapshot(client)
    assert [row["id"] for row in eligibility.filter_public_rows([good, draft], snap, now=NOW)] == ["doc-1"]


def test_authorization_allows_public_rows_to_anonymous_actor():
    client = Client(sources=[source()], documents=[document()], revisions=[revision()])
    snap = snapshot(client)
    allowed = eligibility.authorize_document_rows(
        Actor(ActorKind.ANONYMOUS), {"doc-1": document()}, snap, now=NOW
    )
    assert list(allowed) == ["doc-1"]


def test_authorization_allows_private_row_only_to_its_owner():
    private = document(
        id="doc-private",
        visibility_scope="private",
        publication_status="draft",
        owner_type="citizen",
        owner_id="user_owner",
    )
    client = Client(sources=[source()], documents=[private], revisions=[revision()])
    snap = snapshot(client)

    owner = Actor(ActorKind.CITIZEN, "user_owner")
    assert list(eligibility.authorize_document_rows(owner, {"doc-private": private}, snap, now=NOW)) == [
        "doc-private"
    ]

    other = Actor(ActorKind.CITIZEN, "user_other")
    with pytest.raises(HTTPException) as exc:
        eligibility.authorize_document_rows(other, {"doc-private": private}, snap, now=NOW)
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as anon:
        eligibility.authorize_document_rows(
            Actor(ActorKind.ANONYMOUS), {"doc-private": private}, snap, now=NOW
        )
    assert anon.value.status_code == 404


def test_authorization_denies_unknown_requested_document():
    client = Client(sources=[source()], documents=[document()], revisions=[revision()])
    snap = snapshot(client)
    with pytest.raises(HTTPException) as exc:
        eligibility.authorize_document_rows(
            Actor(ActorKind.ANONYMOUS), {}, snap, now=NOW, requested_ids=["missing"]
        )
    assert exc.value.status_code == 404


def test_expiry_records_one_event_and_is_retry_safe():
    doc = document(expires_at=(NOW - timedelta(minutes=1)).isoformat())
    client = Client(sources=[source()], documents=[doc], revisions=[revision()])

    assert expire_document(client, doc, now=NOW) is True
    assert client.tables["lr_documents"][0]["publication_status"] == "expired"
    events = client.tables["publication_events"]
    assert len(events) == 1
    assert events[0]["event_type"] == "expiration"
    assert events[0]["idempotency_key"] == expiration_idempotency_key("doc-1", 1)

    assert expire_document(client, doc, now=NOW) is False
    assert len(client.tables["publication_events"]) == 1


def test_expiry_store_failure_is_not_silently_ignored():
    doc = document()
    client = Client(documents=[doc], fail={"publication_events"})
    with pytest.raises(PublicationStoreUnavailable):
        expire_document(client, doc, now=NOW)


def test_event_append_is_append_only_and_idempotent():
    client = Client()
    kwargs = dict(
        document_id="doc-1",
        revision=1,
        event_type="publication",
        actor="operator-1",
        idempotency_key="publication:doc-1:1",
    )
    assert record_publication_event(client, **kwargs) is True
    assert record_publication_event(client, **kwargs) is False
    assert len(client.tables["publication_events"]) == 1
