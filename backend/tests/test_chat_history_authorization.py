import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

from auth_helpers import install_fake_jwks, make_keypair, mint_token
from routers import chat
from utils import chat_history


PRIVATE_KEY, PUBLIC_KEY = make_keypair()


@pytest.fixture
def client(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    app = FastAPI()
    app.include_router(chat.router, prefix="/api/chat")
    app.include_router(chat.me_v1_router, prefix="/api/v1/me")
    with TestClient(app) as test_client:
        yield test_client


def bearer(sub="user_alice", **claims):
    return {"Authorization": f"Bearer {mint_token(PRIVATE_KEY, sub=sub, **claims)}"}


@pytest.fixture
def calls(monkeypatch):
    seen = {"history": [], "conversations": [], "renames": []}
    monkeypatch.setattr(
        chat, "list_chat_messages",
        lambda **kwargs: seen["history"].append(kwargs) or [],
    )
    monkeypatch.setattr(
        chat, "list_conversations",
        lambda user_id: seen["conversations"].append(user_id) or [],
    )
    monkeypatch.setattr(
        chat, "update_conversation_title",
        lambda user_id, session_id, title: seen["renames"].append(
            (user_id, session_id, title)
        ) or True,
    )
    return seen


@pytest.fixture
def database_acquisitions(monkeypatch):
    acquired = []
    monkeypatch.setattr(
        chat_history, "get_supabase", lambda **kwargs: acquired.append(kwargs)
    )
    return acquired


@pytest.mark.parametrize("path,method", [
    ("/api/chat/history", "get"),
    ("/api/chat/conversations", "get"),
    ("/api/chat/conversations/s1", "patch"),
    ("/api/chat/history/d1", "delete"),
])
def test_missing_identity_rejected_before_history_operations(
    client, calls, database_acquisitions, path, method
):
    request = getattr(client, method)
    response = (
        request(path, json={"title": "Changed"})
        if method == "patch" else request(path)
    )
    assert response.status_code == 401
    assert calls == {"history": [], "conversations": [], "renames": []}
    assert database_acquisitions == []


@pytest.mark.parametrize("claims", [
    {"token": "not-a-jwt"},
    {"expires_in": -120},
    {"issuer": "https://wrong.example.test"},
])
def test_invalid_or_expired_identity_rejected_before_database(
    client, calls, database_acquisitions, claims
):
    headers = (
        {"Authorization": "Bearer not-a-jwt"}
        if "token" in claims else bearer(**claims)
    )
    response = client.get("/api/chat/history", headers=headers)
    assert response.status_code == 401
    assert calls["history"] == []
    assert database_acquisitions == []


@pytest.mark.parametrize("params,headers", [
    ({"user_id": "user_bob"}, {}),
    ({}, {"X-User-Id": "user_bob"}),
])
def test_forged_user_id_rejected(client, calls, database_acquisitions, params, headers):
    response = client.get("/api/chat/history", params=params, headers={**bearer(), **headers})
    assert response.status_code == 403
    assert calls["history"] == []
    assert database_acquisitions == []


def test_owner_history_is_scoped_to_verified_identity_and_requested_ids(client, calls):
    response = client.get(
        "/api/chat/history",
        params={"session_id": "foreign-session", "document_id": "foreign-document"},
        headers={**bearer(), "X-User-Id": "user_alice"},
    )
    assert response.status_code == 200
    assert calls["history"] == [{
        "document_id": "foreign-document",
        "session_id": "foreign-session",
        "user_id": "user_alice",
    }]


@pytest.mark.parametrize("params", [
    {"session_id": ""}, {"session_id": " "},
    {"document_id": ""}, {"document_id": " "},
])
def test_empty_history_filters_rejected_without_database(
    client, calls, database_acquisitions, params
):
    response = client.get("/api/chat/history", params=params, headers=bearer())
    assert response.status_code == 400
    assert calls["history"] == []
    assert database_acquisitions == []


def test_owner_can_list_and_rename_conversations(client, calls):
    listed = client.get("/api/chat/conversations", headers=bearer())
    renamed = client.patch(
        "/api/chat/conversations/session-1",
        headers=bearer(),
        json={"title": "  My conversation  "},
    )
    assert listed.status_code == 200
    assert calls["conversations"] == ["user_alice"]
    assert renamed.status_code == 200
    assert calls["renames"] == [("user_alice", "session-1", "My conversation")]


def test_foreign_session_rename_is_not_found(client, calls, monkeypatch):
    # The database update reports no matching owner-scoped row for this session.
    monkeypatch.setattr(chat, "update_conversation_title", lambda *args: False)
    response = client.patch(
        "/api/chat/conversations/foreign-session",
        headers=bearer(),
        json={"title": "Claim it"},
    )
    assert response.status_code == 404


def test_anonymous_history_list_retrieve_rename_and_delete_fail_closed(
    client, calls, database_acquisitions
):
    headers = {"X-User-Id": "browser-anon-id"}
    responses = [
        client.get("/api/chat/conversations", headers=headers),
        client.get("/api/chat/history", params={"session_id": "s1"}, headers=headers),
        client.patch("/api/chat/conversations/s1", headers=headers, json={"title": "x"}),
        client.delete("/api/chat/history/d1", params={"session_id": "s1"}, headers=headers),
    ]
    assert [r.status_code for r in responses] == [401, 401, 401, 401]
    assert calls == {"history": [], "conversations": [], "renames": []}
    assert database_acquisitions == []


def test_owner_scoped_utilities_reject_empty_filters_before_client_acquisition(monkeypatch):
    acquired = []
    monkeypatch.setattr(chat_history, "get_supabase", lambda **kwargs: acquired.append(kwargs))
    with pytest.raises(ValueError):
        chat_history.list_chat_messages(user_id="user_alice", session_id="")
    with pytest.raises(ValueError):
        chat_history.list_chat_messages(user_id="user_alice", document_id=" ")
    assert not chat_history.update_conversation_title("user_alice", " ", "name")
    assert acquired == []


def test_rename_query_contains_both_session_and_owner_predicates(monkeypatch):
    filters = []

    class Query:
        def update(self, payload):
            return self

        def eq(self, field, value):
            filters.append((field, value))
            return self

        def select(self, columns):
            return self

        def execute(self):
            return type("Response", (), {"data": []})()

    class Client:
        def table(self, name):
            return Query()

    monkeypatch.setattr(chat_history, "get_supabase", lambda *, admin=False: Client())
    assert not chat_history.update_conversation_title("user_alice", "foreign-session", "name")
    assert filters == [("session_id", "foreign-session"), ("user_id", "user_alice")]


def test_history_read_query_always_contains_owner_and_optional_narrowing_predicates(monkeypatch):
    filters = []

    class Query:
        def select(self, columns):
            return self

        def eq(self, field, value):
            filters.append((field, value))
            return self

        def order(self, field, desc=False):
            return self

        def execute(self):
            return type("Response", (), {"data": []})()

    class Client:
        def table(self, name):
            return Query()

    monkeypatch.setattr(chat_history, "get_supabase", lambda: Client())
    assert chat_history.list_chat_messages(
        user_id="user_alice", session_id="session-1", document_id="document-1"
    ) == []
    assert filters == [
        ("user_id", "user_alice"),
        ("document_id", "document-1"),
        ("session_id", "session-1"),
    ]


def test_v1_history_uses_clerk_owner_and_document_scope(client, calls):
    response = client.get(
        "/api/v1/me/history",
        params={
            "document_ref": "doc-1",
            "conversation_ref": "session-1",
            "user_id": "user_bob",
        },
        headers={**bearer("user_alice"), "X-User-Id": "user_bob"},
    )

    assert response.status_code == 200
    assert calls["history"] == [{
        "document_id": "doc-1",
        "session_id": "session-1",
        "user_id": "user_alice",
    }]


def test_v1_history_requires_document_scope_before_database(client, calls, database_acquisitions):
    response = client.get(
        "/api/v1/me/history?document_ref=%20",
        headers=bearer("user_alice"),
    )

    assert response.status_code == 400
    assert calls["history"] == []
    assert database_acquisitions == []


def test_v1_delete_uses_clerk_owner_and_both_scope_predicates(client, monkeypatch):
    deleted = []
    monkeypatch.setattr(
        chat,
        "delete_chat_messages",
        lambda **kwargs: deleted.append(kwargs) or 2,
    )
    response = client.delete(
        "/api/v1/me/history",
        params={"document_ref": "doc-1", "conversation_ref": "session-1", "user_id": "user_bob"},
        headers={**bearer("user_alice"), "X-User-Id": "user_bob"},
    )

    assert response.status_code == 200
    assert response.json()["deleted_rows"] == 2
    assert deleted == [{
        "document_id": "doc-1",
        "user_id": "user_alice",
        "session_id": "session-1",
    }]


def test_v1_delete_without_identity_or_document_scope_does_not_delete(client, monkeypatch):
    deleted = []
    monkeypatch.setattr(chat, "delete_chat_messages", lambda **kwargs: deleted.append(kwargs))

    no_identity = client.delete("/api/v1/me/history?document_ref=doc-1")
    no_scope = client.delete("/api/v1/me/history", headers=bearer("user_alice"))

    assert no_identity.status_code == 401
    assert no_scope.status_code == 422
    assert deleted == []
