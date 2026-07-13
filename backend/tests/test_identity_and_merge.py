import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

import pytest
from fastapi import HTTPException

from auth_helpers import install_fake_jwks, make_keypair, mint_token

PRIVATE_KEY, PUBLIC_KEY = make_keypair()


class FakeRequest:
    def __init__(self, auth_header=None):
        self.headers = {}
        if auth_header is not None:
            self.headers["authorization"] = auth_header


# ── FakeSupabase with update support (extends the pattern in test_share_fields.py) ──

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


def _verified(monkeypatch, sub="user_abc"):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    token = mint_token(PRIVATE_KEY, sub=sub)
    from utils.auth import get_verified_user
    return get_verified_user(FakeRequest(f"Bearer {token}"))


def test_merge_moves_rows_in_both_tables(monkeypatch):
    from routers import user as user_router
    store = {
        "lr_chat_messages": [
            {"user_id": "anon-1", "question": "q1"},
            {"user_id": "anon-1", "question": "q2"},
            {"user_id": "other", "question": "q3"},
        ],
        "lr_shared_answers": [{"user_id": "anon-1", "slug": "s1"}],
    }
    monkeypatch.setattr(user_router, "get_supabase", lambda: FakeSupabase(store))
    body = user_router.MergeRequest(anon_user_id="anon-1")
    resp = user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert resp.chat_rows == 2
    assert resp.share_rows == 1
    assert store["lr_chat_messages"][0]["user_id"] == "user_abc"
    assert store["lr_chat_messages"][2]["user_id"] == "other"


def test_merge_is_idempotent(monkeypatch):
    from routers import user as user_router
    store = {"lr_chat_messages": [], "lr_shared_answers": []}
    monkeypatch.setattr(user_router, "get_supabase", lambda: FakeSupabase(store))
    body = user_router.MergeRequest(anon_user_id="anon-gone")
    resp = user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert resp.chat_rows == 0
    assert resp.share_rows == 0


def test_merge_requires_auth():
    from routers import user as user_router
    body = user_router.MergeRequest(anon_user_id="anon-1")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=None)
    assert exc.value.status_code == 401


def test_merge_rejects_clerk_id_as_anon(monkeypatch):
    from routers import user as user_router
    body = user_router.MergeRequest(anon_user_id="user_victim")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert exc.value.status_code == 400


def test_merge_tolerates_missing_share_column(monkeypatch):
    from routers import user as user_router

    class ExplodingShareSupabase(FakeSupabase):
        def table(self, name):
            if name == "lr_shared_answers":
                raise RuntimeError("column lr_shared_answers.user_id does not exist")
            return super().table(name)

    store = {"lr_chat_messages": [{"user_id": "anon-1"}]}
    monkeypatch.setattr(user_router, "get_supabase", lambda: ExplodingShareSupabase(store))
    body = user_router.MergeRequest(anon_user_id="anon-1")
    resp = user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert resp.chat_rows == 1
    assert resp.share_rows == 0


def test_conversations_token_overrides_query_user(monkeypatch):
    import routers.chat as chat
    captured = {}
    def fake_list(uid):
        captured["uid"] = uid
        return []

    monkeypatch.setattr(chat, "list_conversations", fake_list)
    import asyncio
    asyncio.run(chat.get_conversations(user_id="spoofed-id", verified="user_abc"))
    assert captured["uid"] == "user_abc"


def test_history_payload_uses_verified_user():
    from routers.chat import AskRequest, _history_payload
    body = AskRequest(
        user_id="user_abc",  # handler has already overridden this from the token
        document_id="d1",
        document_name="Doc",
        session_id="s1",
        question="q",
    )
    payload = _history_payload(body, {}, "2026-01-01T00:00:00Z", "a")
    assert payload["user_id"] == "user_abc"
