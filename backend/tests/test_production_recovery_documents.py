"""Production-recovery regressions for the public catalogue and PDF path.

Original failures pinned here:

1. An unreachable public catalogue returned an empty list (200), so the UI
   looked like a fresh install while documents existed.
2. The PDF proxy read storage with the anon key against a private bucket.

Publication eligibility is now registry-backed: legacy rows without an
approved source, published lifecycle and current approved revision stay
private. These tests keep the recovery guarantees and add the new boundary.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import documents

SOURCES = [
    {
        "source_id": "src-official-1",
        "source_type": "official_gov",
        "verification_status": "verified",
        "usage_permitted": True,
        "usage_rights": "Public information with attribution.",
        "freshness_days": 365,
        "last_verified_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "revoked_at": None,
    }
]

LEGACY_ROW = {
    "id": "legacy-doc",
    "name": "Legacy public document.pdf",
    "size_bytes": 12,
    "chunk_count": 3,
    "status": "ready",
    "uploaded_at": "2026-01-01T00:00:00+00:00",
    "storage_path": "legacy-doc/file.pdf",
    "public_url": None,
    "error_message": None,
}

PRIVATE_ROW = {
    **LEGACY_ROW,
    "id": "private-doc",
    "name": "Private draft.pdf",
    "visibility_scope": "private",
    "publication_status": "draft",
}

PUBLISHED_ROW = {
    **LEGACY_ROW,
    "id": "published-doc",
    "name": "Published document.pdf",
    "storage_path": "published-doc/upload.pdf",
    "visibility_scope": "public",
    "publication_status": "published",
    "status": "ready",
    "source_id": "src-official-1",
    "source_type": "official_gov",
    "owner_type": "operator",
    "owner_id": "operator-1",
    "approved_by": "operator-1",
    "approved_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
    "published_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    "last_verified_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    "current_revision": 1,
}

REVISION_ROW = {
    "document_id": "published-doc",
    "revision": 1,
    "storage_path": "published-doc/revision-1.pdf",
    "approved_by": "operator-1",
    "approved_at": PUBLISHED_ROW["approved_at"],
    "superseded_at": None,
    "revoked_at": None,
}


class FakeClient:
    def __init__(self, tables, calls, admin):
        self.tables = tables
        self.calls = calls
        self.admin = admin
        self._table = None
        self._rows = []

    def table(self, name):
        self.calls.append(("table", name, self.admin))
        self._table = name
        self._rows = list(self.tables.get(name, []))
        return self

    def select(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self._rows = [row for row in self._rows if str(row.get(field)) == str(value)]
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=list(self._rows))

    @property
    def storage(self):
        return self

    def from_(self, bucket):
        self.calls.append(("bucket", bucket, self.admin))
        return self

    def download(self, path):
        self.calls.append(("download", path, self.admin))
        return b"%PDF-1.4 recovery-test"

    def create_signed_url(self, path, expires_in):
        self.calls.append(("signed", path, self.admin, expires_in))
        return {"signedURL": f"https://storage.test/{path}?token=test"}


@pytest.fixture
def client():
    app = FastAPI()
    app.state.limiter = documents.limiter
    app.include_router(documents.router, prefix="/api/documents")
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _legacy_override_off(monkeypatch):
    """Denial tests must not inherit the local owner override from .env."""
    monkeypatch.delenv("ALLOW_LEGACY_PUBLIC_DOCUMENTS", raising=False)


def install_rows(monkeypatch, document_rows, *, sources=SOURCES, revisions=(REVISION_ROW,)):
    calls = []
    tables = {
        "lr_documents": list(document_rows),
        "official_sources": list(sources),
        "document_revisions": list(revisions),
        "publication_events": [],
    }

    def factory(admin=False):
        return FakeClient(tables, calls, admin)

    monkeypatch.setattr(documents, "get_supabase", factory)
    return calls


def test_legacy_and_private_rows_stay_hidden_while_published_rows_are_public(client, monkeypatch):
    calls = install_rows(monkeypatch, [LEGACY_ROW, PRIVATE_ROW, PUBLISHED_ROW])

    response = client.get("/api/documents/")

    assert response.status_code == 200
    body = response.json()
    assert [doc["id"] for doc in body] == ["published-doc"]
    assert body[0]["pdf_url"] == "/api/documents/published-doc/pdf"
    assert body[0]["storage_path"] is None
    assert body[0]["public_url"] is None


def test_expired_or_revoked_public_rows_are_hidden(client, monkeypatch):
    expired = {
        **PUBLISHED_ROW,
        "id": "expired-doc",
        "expires_at": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(),
    }
    revoked = {**PUBLISHED_ROW, "id": "revoked-doc", "revoked_at": "2026-01-01T00:00:00Z"}
    install_rows(monkeypatch, [expired, revoked])

    response = client.get("/api/documents/")

    assert response.status_code == 200
    assert response.json() == []


def test_catalogue_falls_back_to_service_client_when_anon_key_is_unusable(client, monkeypatch):
    calls = []

    def factory(admin=False):
        if not admin:
            raise ValueError("invalid SUPABASE_ANON_KEY")
        return FakeClient(
            {
                "lr_documents": [PUBLISHED_ROW],
                "official_sources": SOURCES,
                "document_revisions": [REVISION_ROW],
                "publication_events": [],
            },
            calls,
            admin,
        )

    monkeypatch.setattr(documents, "get_supabase", factory)

    response = client.get("/api/documents/")

    assert response.status_code == 200
    assert [doc["id"] for doc in response.json()] == ["published-doc"]
    assert any(call[0] == "table" and call[2] is True for call in calls)


def test_catalogue_unavailable_is_503_not_empty_library(client, monkeypatch):
    monkeypatch.setattr(
        documents,
        "get_supabase",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("anon key missing")),
    )

    response = client.get("/api/documents/")

    assert response.status_code == 503
    assert response.json()["detail"] == "Document catalogue is temporarily unavailable."


def test_catalogue_registry_outage_fails_closed(client, monkeypatch):
    def factory(admin=False):
        client_ = FakeClient({"lr_documents": [PUBLISHED_ROW]}, [], admin)
        if admin:
            raise RuntimeError("registry unavailable")
        return client_

    monkeypatch.setattr(documents, "get_supabase", factory)

    response = client.get("/api/documents/")

    assert response.status_code == 503


def test_catalogue_missing_publication_tables_returns_empty_not_503(client, monkeypatch):
    class MissingTables(FakeClient):
        def table(self, name):
            if name in {"official_sources", "document_revisions"}:
                raise Exception(f'Error 42P01: relation "public.{name}" does not exist')
            return super().table(name)

    def factory(admin=False):
        return MissingTables({"lr_documents": [PUBLISHED_ROW]}, [], admin)

    monkeypatch.setattr(documents, "get_supabase", factory)

    response = client.get("/api/documents/")

    assert response.status_code == 200
    assert response.json() == []


def test_pdf_proxy_serves_current_approved_revision_through_service_client(client, monkeypatch):
    calls = install_rows(monkeypatch, [PUBLISHED_ROW])

    response = client.get("/api/documents/published-doc/pdf")

    assert response.status_code == 200
    assert response.content == b"%PDF-1.4 recovery-test"
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline;")
    assert response.headers["cache-control"] == "no-store"
    assert ("download", "published-doc/revision-1.pdf", True) in calls
    assert ("table", "lr_documents", False) in calls

    assert ("table", "official_sources", True) in calls
    assert ("table", "document_revisions", True) in calls


def test_pdf_proxy_supports_explicit_download(client, monkeypatch):
    install_rows(monkeypatch, [PUBLISHED_ROW])

    response = client.get("/api/documents/published-doc/pdf?download=1")

    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment;")


def test_pdf_proxy_uses_revision_path_not_stale_document_path(client, monkeypatch):
    calls = install_rows(monkeypatch, [PUBLISHED_ROW])

    assert client.get("/api/documents/published-doc/pdf").status_code == 200
    assert ("download", "published-doc/upload.pdf", True) not in calls
    assert ("download", "published-doc/revision-1.pdf", True) in calls


@pytest.mark.parametrize(
    "row",
    [
        LEGACY_ROW,
        PRIVATE_ROW,
        PUBLISHED_ROW | {"status": "processing"},
        PUBLISHED_ROW | {"approved_by": ""},
    ],
)
def test_pdf_proxy_never_serves_ineligible_rows(client, monkeypatch, row):
    calls = install_rows(monkeypatch, [row])

    response = client.get(f"/api/documents/{row['id']}/pdf")

    assert response.status_code == 404
    assert not any(kind == "download" for kind, *_rest in calls)


def test_pdf_proxy_reports_storage_outage_without_leaking_details(client, monkeypatch):
    class BrokenStorage(FakeClient):
        def download(self, path):
            raise RuntimeError("storage down")

    calls = []

    def factory(admin=False):
        return BrokenStorage(
            {
                "lr_documents": [PUBLISHED_ROW],
                "official_sources": SOURCES,
                "document_revisions": [REVISION_ROW],
                "publication_events": [],
            },
            calls,
            admin,
        )

    monkeypatch.setattr(documents, "get_supabase", factory)

    response = client.get("/api/documents/published-doc/pdf")

    assert response.status_code == 404
    assert response.json()["detail"] == "PDF file not found in storage"
    assert "storage down" not in response.text


def test_signed_storage_urls_are_no_longer_issued(client, monkeypatch):
    calls = install_rows(monkeypatch, [PUBLISHED_ROW])

    response = client.get("/api/documents/published-doc/pdf-url")

    assert response.status_code == 410
    assert not any(kind == "signed" for kind, *_rest in calls)
    assert "https://storage.test" not in response.text


def test_signed_url_endpoint_still_hides_ineligible_documents(client, monkeypatch):
    calls = install_rows(monkeypatch, [PRIVATE_ROW])

    response = client.get("/api/documents/private-doc/pdf-url")

    assert response.status_code == 404
    assert not any(kind == "signed" for kind, *_rest in calls)


def test_catalogue_legacy_compatibility_when_operator_opts_in(client, monkeypatch):
    monkeypatch.setenv("ALLOW_LEGACY_PUBLIC_DOCUMENTS", "true")
    legacy = {
        **LEGACY_ROW,
        "visibility_scope": "unclassified",
        "publication_status": "draft",
        "status": "ready",
    }
    calls = install_rows(monkeypatch, [legacy], sources=[], revisions=())

    response = client.get("/api/documents/")

    assert response.status_code == 200
    assert [doc["id"] for doc in response.json()] == ["legacy-doc"]
    assert response.json()[0]["pdf_url"] == "/api/documents/legacy-doc/pdf"
    assert any(call[0] == "table" for call in calls)


def test_catalogue_legacy_compatibility_stays_off_by_default(client, monkeypatch):
    monkeypatch.delenv("ALLOW_LEGACY_PUBLIC_DOCUMENTS", raising=False)
    legacy = {
        **LEGACY_ROW,
        "visibility_scope": "unclassified",
        "publication_status": "draft",
        "status": "ready",
    }
    install_rows(monkeypatch, [legacy], sources=[], revisions=())

    response = client.get("/api/documents/")

    assert response.status_code == 200
    assert response.json() == []


def test_legacy_pdf_proxy_uses_document_storage_path_when_opted_in(client, monkeypatch):
    monkeypatch.setenv("ALLOW_LEGACY_PUBLIC_DOCUMENTS", "true")
    legacy = {
        **LEGACY_ROW,
        "visibility_scope": "unclassified",
        "publication_status": "draft",
        "status": "ready",
    }
    calls = install_rows(monkeypatch, [legacy], sources=[], revisions=())

    response = client.get("/api/documents/legacy-doc/pdf")

    assert response.status_code == 200
    assert ("download", "legacy-doc/file.pdf", True) in calls


def test_document_status_returns_503_when_catalogue_unavailable(client, monkeypatch):
    monkeypatch.setattr(
        documents,
        "get_supabase",
        lambda **_kwargs: (_ for _ in ()).throw(ValueError("SUPABASE_ANON_KEY missing")),
    )

    response = client.get("/api/documents/legacy-doc/status")

    assert response.status_code == 503
    assert "SUPABASE_ANON_KEY" not in response.text
