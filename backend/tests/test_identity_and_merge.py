import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from auth_helpers import install_fake_jwks, make_keypair, mint_token

PRIVATE_KEY, PUBLIC_KEY = make_keypair()


class FakeRequest:
    def __init__(self, auth_header=None):
        self.headers = {}
        if auth_header is not None:
            self.headers["authorization"] = auth_header




class FakeQuery:
    def __init__(self, store, table):
        self.store = store
        self.table_name = table
        self._update_payload = None
        self._eq = None

    def update(self, payload):
        self._update_payload = payload
        return self

    def eq(self, field, value):
        self._eq = (field, value)
        return self

    def execute(self):
        class Res:
            pass
        res = Res()
        field, value = self._eq
        updated = []
        for row in self.store.get(self.table_name, []):
            if row.get(field) == value:
                row.update(self._update_payload)
                updated.append(row)
        res.data = updated
        return res


class FakeSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return FakeQuery(self.store, name)


def _admin_client(client):
    def get_client(*, admin=False):
        assert admin is True, "Identity reassignment must explicitly use the admin client"
        return client
    return get_client


def _verified(monkeypatch, sub="user_abc"):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    token = mint_token(PRIVATE_KEY, sub=sub)
    from utils.auth import get_verified_user
    return get_verified_user(FakeRequest(f"Bearer {token}"))


def test_merge_fails_closed_without_source_ownership_proof(monkeypatch):
    from routers import user as user_router
    store = {
        "lr_chat_messages": [
            {"user_id": "anon-1", "question": "q1"},
            {"user_id": "anon-1", "question": "q2"},
            {"user_id": "other", "question": "q3"},
        ],
        "lr_shared_answers": [{"user_id": "anon-1", "slug": "s1"}],
    }
    client_calls = []
    monkeypatch.setattr(user_router, "get_supabase", lambda **kwargs: client_calls.append(kwargs), raising=False)
    body = user_router.MergeRequest(anon_user_id="anon-1")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert exc.value.status_code == 503
    assert store["lr_chat_messages"][0]["user_id"] == "anon-1"
    assert client_calls == []


def test_merge_does_not_acquire_admin_client_for_unverified_source(monkeypatch):
    from routers import user as user_router
    client_calls = []
    monkeypatch.setattr(user_router, "get_supabase", lambda **kwargs: client_calls.append(kwargs), raising=False)
    body = user_router.MergeRequest(anon_user_id="anon-gone")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert exc.value.status_code == 503
    assert client_calls == []


def test_merge_requires_auth():
    from routers import user as user_router
    body = user_router.MergeRequest(anon_user_id="anon-1")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=None)
    assert exc.value.status_code == 401


def test_merge_http_route_fails_closed_without_acquiring_admin_client(monkeypatch):
    from routers import user as user_router

    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    monkeypatch.setattr(
        user_router,
        "get_supabase",
        lambda **_kwargs: pytest.fail("admin client must not be acquired"),
        raising=False,
    )
    app = FastAPI()
    app.include_router(user_router.router, prefix="/api/user")
    token = mint_token(PRIVATE_KEY, sub="user_destination")

    with TestClient(app) as client:
        response = client.post(
            "/api/user/merge-anon",
            headers={"Authorization": f"Bearer {token}"},
            json={"anon_user_id": "browser-controlled-source"},
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "Anonymous history linking is temporarily unavailable."


def test_merge_does_not_attempt_to_classify_caller_supplied_source_id(monkeypatch):
    from routers import user as user_router
    body = user_router.MergeRequest(anon_user_id="user_victim")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert exc.value.status_code == 503


def test_merge_does_not_partially_reassign_rows(monkeypatch):
    from routers import user as user_router
    store = {"lr_chat_messages": [{"user_id": "anon-1"}]}
    monkeypatch.setattr(user_router, "get_supabase", lambda **kwargs: pytest.fail("admin client acquired"), raising=False)
    body = user_router.MergeRequest(anon_user_id="anon-1")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert exc.value.status_code == 503
    assert store["lr_chat_messages"][0]["user_id"] == "anon-1"


def test_conversations_rejects_user_id_that_disagrees_with_verified_subject(monkeypatch):
    import routers.chat as chat
    import asyncio
    with pytest.raises(HTTPException) as exc:
        asyncio.run(chat.get_conversations(user_id="spoofed-id", x_user_id=None, verified="user_abc"))
    assert exc.value.status_code == 403


def test_conversations_rejects_spoofed_clerk_id_without_token():
    import routers.chat as chat
    import asyncio
    with pytest.raises(HTTPException) as exc:
        asyncio.run(chat.get_conversations(user_id="user_victim", x_user_id=None, verified=None))
    assert exc.value.status_code == 401


def test_conversations_rejects_anonymous_id_from_header(monkeypatch):

    import routers.chat as chat
    import asyncio
    with pytest.raises(HTTPException) as exc:
        asyncio.run(chat.get_conversations(user_id="", x_user_id="anon-header-id", verified=None))
    assert exc.value.status_code == 401


def test_conversations_rejects_spoofed_clerk_id_via_header():
    import routers.chat as chat
    import asyncio
    with pytest.raises(HTTPException) as exc:
        asyncio.run(chat.get_conversations(user_id="", x_user_id="user_victim", verified=None))
    assert exc.value.status_code == 401


def test_history_payload_uses_verified_user():
    from routers.chat import AskRequest, _history_payload
    body = AskRequest(
        user_id="user_abc",
        document_id="d1",
        document_name="Doc",
        session_id="s1",
        question="q",
    )
    payload = _history_payload(body, {}, "2026-01-01T00:00:00Z", "a")
    assert payload["user_id"] == "user_abc"
