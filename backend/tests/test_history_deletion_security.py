import os
import sys
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

from auth_helpers import install_fake_jwks, make_keypair, mint_token
from routers import chat, documents
from utils import chat_history as history

PRIVATE_KEY, PUBLIC_KEY = make_keypair()


class RecordingDatabase:
    def __init__(self):
        self.rows = [
            {"user_id": "user_alice", "document_id": "d1", "session_id": "s1"},
            {"user_id": "user_bob", "document_id": "d1", "session_id": "s1"},
            {"user_id": "user_alice", "document_id": "d1", "session_id": "s2"},
            {"user_id": "user_alice", "document_id": "d2", "session_id": "s1"},
        ]
        self.acquisitions = []
        self.executions = []

    def get_client(self, *, admin=False):
        self.acquisitions.append(admin)
        assert admin is True
        return self

    def table(self, name):
        assert name == history.CHAT_HISTORY_TABLE
        return DeleteQuery(self)


class DeleteQuery:
    def __init__(self, database):
        self.database = database
        self.filters = {}

    def delete(self):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def execute(self):
        self.database.executions.append(dict(self.filters))
        deleted = [row for row in self.database.rows if all(
            row.get(field) == value for field, value in self.filters.items()
        )]
        self.database.rows = [row for row in self.database.rows if row not in deleted]
        return SimpleNamespace(data=deleted)


@pytest.fixture
def db(monkeypatch):
    database = RecordingDatabase()
    monkeypatch.setattr(history, "get_supabase", database.get_client)
    return database


@pytest.fixture
def client(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    app = FastAPI()
    app.include_router(chat.router, prefix="/api/chat")
    app.include_router(documents.router, prefix="/api/documents")
    with TestClient(app) as client:
        yield client


def auth_headers(**claims):
    return {"Authorization": "Bearer " + mint_token(
        PRIVATE_KEY, sub="user_alice", **claims
    )}


@pytest.mark.parametrize("params", [
    {}, {"user_id": ""}, {"session_id": "s1"},
    {"user_id": "user_alice"}, {"user_id": "user_bob"},
    {"user_id": "browser-anon-id", "session_id": "s1"},
])
def test_missing_identity_never_acquires_database(client, db, params):
    response = client.delete("/api/chat/history/d1", params=params)
    assert response.status_code == 401
    assert db.acquisitions == []
    assert db.executions == []


@pytest.mark.parametrize("forged", ["user_bob", "browser-anon-id", "", " "])
def test_authenticated_forged_owner_is_rejected(client, db, forged):
    response = client.delete("/api/chat/history/d1", params={"user_id": forged}, headers=auth_headers())
    assert response.status_code == 403
    assert db.acquisitions == []
    assert db.executions == []


def test_anonymous_header_is_not_ownership_proof(client, db):
    response = client.delete("/api/chat/history/d1", headers={"X-User-Id": "browser-anon-id"})
    assert response.status_code == 401
    assert db.acquisitions == []
    assert db.executions == []


@pytest.mark.parametrize("headers", [
    {"Authorization": "Bearer forged-token"},
    {"Authorization": "Bearer "},
    auth_headers(expires_in=-120),
    auth_headers(issuer="https://wrong.example.test"),
])
def test_invalid_identity_does_not_reach_database(client, db, headers):
    response = client.delete("/api/chat/history/d1", headers=headers)
    assert response.status_code == 401
    assert db.acquisitions == []
    assert db.executions == []


@pytest.mark.parametrize("params", [{}, {"user_id": "user_alice"}])
def test_verified_subject_is_owner_even_without_query_user_id(client, db, params):
    response = client.delete("/api/chat/history/d1", params=params, headers=auth_headers())
    assert response.status_code == 200
    assert response.json()["deleted_rows"] == 2
    assert db.executions == [{"user_id": "user_alice", "document_id": "d1"}]
    assert db.rows == [
        {"user_id": "user_bob", "document_id": "d1", "session_id": "s1"},
        {"user_id": "user_alice", "document_id": "d2", "session_id": "s1"},
    ]


def test_session_does_not_grant_access_to_other_users(client, db):
    response = client.delete("/api/chat/history/d1", params={"session_id": "s1"}, headers=auth_headers())
    assert response.status_code == 200
    assert response.json()["deleted_rows"] == 1
    assert db.executions == [{"user_id": "user_alice", "document_id": "d1", "session_id": "s1"}]
    assert len(db.rows) == 3


def test_owner_has_no_rows_is_safe_noop(client, db):
    response = client.delete("/api/chat/history/other-document", headers=auth_headers())
    assert response.status_code == 200
    assert response.json()["deleted_rows"] == 0
    assert len(db.rows) == 4


@pytest.mark.parametrize("params", [{"session_id": ""}, {"session_id": " "}])
def test_empty_session_does_not_broaden_scope(client, db, params):
    response = client.delete("/api/chat/history/d1", params=params, headers=auth_headers())
    assert response.status_code == 400
    assert db.acquisitions == []
    assert db.executions == []


@pytest.mark.parametrize("scope", [
    {}, {"document_id": "d1"}, {"session_id": "s1"},
    {"document_id": "d1", "user_id": ""},
    {"document_id": "d1", "user_id": " "},
    {"document_id": "", "user_id": "user_alice"},
    {"document_id": " ", "user_id": "user_alice"},
    {"document_id": "d1", "user_id": "user_alice", "session_id": ""},
])
def test_utility_rejects_unscoped_deletion_before_client_acquisition(db, scope):
    with pytest.raises(ValueError):
        history.delete_chat_messages(**scope)
    assert db.acquisitions == []
    assert db.executions == []


def test_clear_helper_has_no_document_wide_fallback(db):
    with pytest.raises(ValueError):
        chat.clear_chat_history("d1", verified_user_id="")
    assert db.acquisitions == []
    assert db.executions == []


def test_deletion_failure_returns_generic_error(client, monkeypatch, caplog):
    def broken_client(**kwargs):
        raise RuntimeError("sensitive-database-error")
    monkeypatch.setattr(history, "get_supabase", broken_client)
    response = client.delete("/api/chat/history/d1", headers=auth_headers())
    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to clear chat history"
    assert "sensitive-database-error" not in caplog.text


@pytest.mark.parametrize("authorized", [False, None, 1])
def test_admin_cleanup_requires_explicit_authorization(db, authorized):
    with pytest.raises(PermissionError):
        history.delete_chat_messages_for_document("d1", admin_authorized=authorized)
    assert db.acquisitions == []
    assert db.executions == []


def test_admin_cleanup_cannot_be_unscoped(db):
    with pytest.raises(ValueError):
        history.delete_chat_messages_for_document(" ", admin_authorized=True)
    assert db.acquisitions == []


def test_document_cleanup_is_disabled_until_trusted_operator_authorization(client, db, monkeypatch):
    calls = []
    monkeypatch.setattr(documents, "verify_upload_token", lambda _token: calls.append("token-check"))
    monkeypatch.setattr(documents, "load_documents", lambda: calls.append("load"))
    monkeypatch.setattr(documents, "delete_document_from_vectorstore", lambda _doc: calls.append("vector-delete"))
    monkeypatch.setattr(documents, "delete_document_record", lambda _doc: calls.append("row-delete"))

    signed_in = client.delete("/api/documents/d1", headers=auth_headers())
    shared_token = client.delete("/api/documents/d1", params={"upload_token": "test-admin-token"})

    assert signed_in.status_code == 503
    assert shared_token.status_code == 503
    assert calls == []
    assert db.acquisitions == []
    assert db.executions == []
