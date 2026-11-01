from datetime import datetime, timezone

import pytest

from utils.document_publication import is_publicly_eligible


NOW = datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)
APPROVED_SOURCES = {"source-ministry-1": "official_gov"}


def eligible_document(**overrides):
    document = {
        "id": "doc-1",
        "visibility_scope": "public",
        "publication_status": "published",
        "status": "ready",
        "source_id": "source-ministry-1",
        "source_type": "official_gov",
        "owner_type": "operator",
        "owner_id": "operator-1",
        "approved_by": "operator-1",
        "approved_at": "2026-10-30T10:00:00Z",
        "published_at": "2026-10-30T11:00:00+00:00",
        "last_verified_at": "2026-10-30T11:30:00+00:00",
        "expires_at": "2026-11-01T00:00:00Z",
        "document_version": 1,
    }
    document.update(overrides)
    return document


def test_explicit_currently_approved_document_is_eligible():
    assert is_publicly_eligible(
        eligible_document(), approved_sources=APPROVED_SOURCES, now=NOW
    )


def test_missing_document_or_source_registry_fails_closed():
    assert not is_publicly_eligible(None, approved_sources=APPROVED_SOURCES, now=NOW)
    assert not is_publicly_eligible(eligible_document(), now=NOW)
    assert not is_publicly_eligible(eligible_document(), approved_sources={}, now=NOW)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("visibility_scope", "unclassified"),
        ("visibility_scope", "private"),
        ("publication_status", "draft"),
        ("publication_status", "review"),
        ("publication_status", "approved"),
        ("publication_status", "suspended"),
        ("publication_status", "expired"),
        ("publication_status", "archived"),
        ("status", "processing"),
        ("status", "error"),
    ],
)
def test_non_public_or_not_ready_states_are_ineligible(field, value):
    assert not is_publicly_eligible(
        eligible_document(**{field: value}),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


@pytest.mark.parametrize(
    "field",
    [
        "visibility_scope",
        "publication_status",
        "status",
        "source_id",
        "source_type",
        "owner_type",
        "approved_by",
        "approved_at",
        "published_at",
        "last_verified_at",
        "document_version",
    ],
)
def test_missing_required_metadata_fails_closed(field):
    assert not is_publicly_eligible(
        eligible_document(**{field: None}),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


def test_unknown_source_and_source_type_mismatch_are_ineligible():
    assert not is_publicly_eligible(
        eligible_document(source_id="unlisted-source"),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )
    assert not is_publicly_eligible(
        eligible_document(source_type="unapproved_type"),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


def test_telegram_document_requires_an_owner_id_even_if_otherwise_published():
    assert not is_publicly_eligible(
        eligible_document(owner_type="telegram_chat", owner_id=""),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )
    assert is_publicly_eligible(
        eligible_document(owner_type="telegram_chat", owner_id="chat-1"),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


@pytest.mark.parametrize(
    "expires_at",
    [
        "2026-10-31T12:00:00Z",
        "2026-10-31T11:59:59Z",
        "not-a-date",
        "2026-11-01T00:00:00",  # Naive local time is ambiguous.
    ],
)
def test_expired_or_malformed_expiry_is_ineligible(expires_at):
    assert not is_publicly_eligible(
        eligible_document(expires_at=expires_at),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


def test_absent_expiry_is_allowed_when_all_other_eligibility_is_explicit():
    assert is_publicly_eligible(
        eligible_document(expires_at=None),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("approved_at", "bad-time"),
        ("approved_at", "2026-10-30T10:00:00"),
        ("published_at", "bad-time"),
        ("last_verified_at", "2026-11-01T00:00:00Z"),
        ("document_version", 0),
        ("document_version", -1),
        ("document_version", True),
    ],
)
def test_malformed_or_future_approval_metadata_is_ineligible(field, value):
    assert not is_publicly_eligible(
        eligible_document(**{field: value}),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


def test_approval_must_precede_publication_and_publication_cannot_be_future():
    assert not is_publicly_eligible(
        eligible_document(
            approved_at="2026-10-30T12:00:00Z",
            published_at="2026-10-30T11:00:00Z",
        ),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )
    assert not is_publicly_eligible(
        eligible_document(published_at="2026-11-01T00:00:00Z"),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


@pytest.mark.parametrize("marker", ["superseded_by", "revoked_at"])
def test_superseded_or_revoked_revision_is_ineligible(marker):
    assert not is_publicly_eligible(
        eligible_document(**{marker: "another-version"}),
        approved_sources=APPROVED_SOURCES,
        now=NOW,
    )


def test_naive_current_time_fails_closed():
    assert not is_publicly_eligible(
        eligible_document(),
        approved_sources=APPROVED_SOURCES,
        now=datetime(2026, 10, 31, 12, 0),
    )


def test_predicate_does_not_mutate_document():
    document = eligible_document()
    original = document.copy()

    is_publicly_eligible(document, approved_sources=APPROVED_SOURCES, now=NOW)

    assert document == original
