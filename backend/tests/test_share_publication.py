"""Public shares revalidate every cited revision before returning evidence."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import share
from utils import eligibility


def _snapshot():
    return eligibility.EligibilitySnapshot(approved_sources={}, revisions_by_document={})


def test_ineligible_citation_suppresses_whole_share(monkeypatch):
    monkeypatch.setattr(share, "get_supabase", lambda **_kwargs: object())
    monkeypatch.setattr(
        share.eligibility,
        "load_documents_for_authorization",
        lambda _client, _ids: ({"doc-1": {"id": "doc-1", "publication_status": "draft"}}, _snapshot()),
    )

    assert share._eligible_share_sources([{"document_id": "doc-1", "text": "t"}]) is None


def test_missing_citation_suppresses_whole_share(monkeypatch):
    monkeypatch.setattr(share, "get_supabase", lambda **_kwargs: object())
    monkeypatch.setattr(
        share.eligibility,
        "load_documents_for_authorization",
        lambda _client, _ids: ({}, _snapshot()),
    )

    assert share._eligible_share_sources([{"document_id": "gone", "text": "t"}]) is None


def test_eligibility_outage_is_503(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise eligibility.EligibilityUnavailable("registry down")

    monkeypatch.setattr(share, "get_supabase", lambda **_kwargs: object())
    monkeypatch.setattr(share.eligibility, "load_documents_for_authorization", unavailable)

    with pytest.raises(HTTPException) as exc:
        share._eligible_share_sources([{"document_id": "doc-1", "text": "t"}])
    assert exc.value.status_code == 503


def test_sources_without_provenance_are_dropped(monkeypatch):
    monkeypatch.setattr(share, "get_supabase", lambda **_kwargs: object())
    monkeypatch.setattr(
        share.eligibility,
        "load_documents_for_authorization",
        lambda _client, _ids: ({}, _snapshot()),
    )

    assert share._eligible_share_sources([{"text": "no document id"}]) == []


def test_eligible_citations_are_returned(monkeypatch):
    monkeypatch.setattr(share, "get_supabase", lambda **_kwargs: object())
    monkeypatch.setattr(
        share.eligibility,
        "load_documents_for_authorization",
        lambda _client, ids: ({doc_id: {"id": doc_id} for doc_id in ids}, _snapshot()),
    )
    monkeypatch.setattr(share.eligibility, "is_document_public", lambda *args, **kwargs: True)

    sources = [{"document_id": "doc-1", "text": "t"}]
    assert share._eligible_share_sources(sources) == sources
