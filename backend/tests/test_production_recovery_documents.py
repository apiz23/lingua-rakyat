"""Production-recovery regressions for the public document catalogue and PDF path.

These tests pin the two failures observed in production on 2026-11-01:

1. An unreachable public catalogue returned an empty list (200), so the UI
   looked like a fresh install while ten documents existed.
2. The PDF proxy read storage with the anon key against a private bucket, which
   storage RLS denies. The proxy must use the trusted service client after it
   has verified the row is part of the public catalogue.
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
    "visibility_scope": "public",
    "publication_status": "published",
    "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
}


class FakeClient:
    def __init__(self, rows, calls, admin):
        self.rows = rows
        self.calls = calls
        self.admin = admin

    def table(self, name):
        self.calls.append(("table", name, self.admin))
        return self

    def select(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=list(self.rows))

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


def install_rows(monkeypatch, rows):
    calls = []

    def factory(admin=False):
        return FakeClient(rows, calls, admin)

    monkeypatch.setattr(documents, "get_supabase", factory)
    return calls


def test_legacy_rows_remain_public_and_new_private_rows_are_hidden(client, monkeypatch):
    calls = install_rows(monkeypatch, [LEGACY_ROW, PRIVATE_ROW, PUBLISHED_ROW])

    response = client.get("/api/documents/")

    assert response.status_code == 200
    assert [doc["id"] for doc in response.json()] == ["legacy-doc", "published-doc"]
    assert calls and all(admin is False for _, _, admin in calls)


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
        return FakeClient([LEGACY_ROW], calls, admin)

    monkeypatch.setattr(documents, "get_supabase", factory)

    response = client.get("/api/documents/")

    assert response.status_code == 200
    assert [doc["id"] for doc in response.json()] == ["legacy-doc"]
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


def test_pdf_proxy_serves_legacy_document_through_service_client(client, monkeypatch):
    calls = install_rows(monkeypatch, [LEGACY_ROW])

    response = client.get("/api/documents/legacy-doc/pdf")

    assert response.status_code == 200
    assert response.content == b"%PDF-1.4 recovery-test"
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline;")
    assert response.headers["cache-control"] == "no-store"
    assert ("download", "legacy-doc/file.pdf", True) in calls
    assert all(call[2] is False for call in calls if call[0] == "table")


def test_pdf_proxy_supports_explicit_download(client, monkeypatch):
    install_rows(monkeypatch, [LEGACY_ROW])

    response = client.get("/api/documents/legacy-doc/pdf?download=1")

    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment;")


@pytest.mark.parametrize("row", [PRIVATE_ROW, PUBLISHED_ROW | {"status": "processing"}])
def test_pdf_proxy_never_serves_non_public_rows(client, monkeypatch, row):
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
        return BrokenStorage([LEGACY_ROW], calls, admin)

    monkeypatch.setattr(documents, "get_supabase", factory)

    response = client.get("/api/documents/legacy-doc/pdf")

    assert response.status_code == 404
    assert response.json()["detail"] == "PDF file not found in storage"
    assert "storage down" not in response.text


def test_pdf_signed_url_is_minted_by_service_client_after_visibility_check(client, monkeypatch):
    calls = install_rows(monkeypatch, [PUBLISHED_ROW])

    response = client.get("/api/documents/published-doc/pdf-url")

    assert response.status_code == 200
    assert response.json()["expires_in"] == 3600
    assert response.json()["url"].startswith("https://storage.test/")
    assert any(call[0] == "signed" and call[2] is True for call in calls)


def test_pdf_signed_url_rejects_private_document(client, monkeypatch):
    calls = install_rows(monkeypatch, [PRIVATE_ROW])

    response = client.get("/api/documents/private-doc/pdf-url")

    assert response.status_code == 404
    assert not any(kind == "signed" for kind, *_rest in calls)


def test_document_status_returns_503_when_catalogue_unavailable(client, monkeypatch):
    monkeypatch.setattr(
        documents,
        "get_supabase",
        lambda **_kwargs: (_ for _ in ()).throw(ValueError("SUPABASE_ANON_KEY missing")),
    )

    response = client.get("/api/documents/legacy-doc/status")

    assert response.status_code == 503
    assert "SUPABASE_ANON_KEY" not in response.text
