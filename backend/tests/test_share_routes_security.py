import os
import sys
from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

from auth_helpers import install_fake_jwks, make_keypair, mint_token
from routers import share
from utils import shared_answers


PRIVATE_KEY, PUBLIC_KEY = make_keypair()


class ShareDatabase:
    def __init__(self):
        self.tables = {
            shared_answers.CHAT_TABLE: [{
                "user_id": "user_alice",
                "session_id": "session-alice",
                "question": "When is the deadline?",
                "answer": "The deadline is 30 June.",
                "language": "en",
                "sources": [{"document_id": "doc-1", "page_start": 4, "text": "Deadline: 30 June."}],
                "confidence": 0.87,
                "confidence_label": "high",
                "created_at": "2026-10-30T12:00:00Z",
            }],
            shared_answers.TABLE: [],
        }
        self.accesses = []
        self.queries = []
        self.fail_owned_share_insert = False

    def get_client(self, *, admin=False):
        self.accesses.append(admin)
        return self

    def table(self, name):
        return ShareQuery(self, name)


class ShareQuery:
    def __init__(self, database, table):
        self.database = database
        self.table_name = table
        self.filters = []
        self.operation = "select"
        self.payload = None
        self.limit_value = None
        self.order_by = None

    def select(self, _columns="*"):
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = deepcopy(payload)
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def order(self, field, desc=False):
        self.order_by = (field, desc)
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def execute(self):
        self.database.queries.append((self.table_name, self.operation, list(self.filters)))
        rows = self.database.tables.setdefault(self.table_name, [])
        if self.operation == "insert":
            if self.database.fail_owned_share_insert and "user_id" in self.payload:
                raise RuntimeError("column lr_shared_answers.user_id does not exist")
            rows.append(self.payload)
            return SimpleNamespace(data=[self.payload])
        matches = [
            row for row in rows
            if all(row.get(field) == value for field, value in self.filters)
        ]
        if self.order_by:
            field, desc = self.order_by
            matches.sort(key=lambda row: row.get(field) or "", reverse=desc)
        if self.limit_value is not None:
            matches = matches[:self.limit_value]
        if self.operation == "delete":
            for row in matches:
                rows.remove(row)
        return SimpleNamespace(data=matches)


@pytest.fixture
def setup(monkeypatch):
    database = ShareDatabase()
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    monkeypatch.setattr(shared_answers, "get_supabase", database.get_client)
    app = FastAPI()
    app.include_router(share.router, prefix="/api/share")
    app.include_router(share.public_v1_router, prefix="/api/v1/public/shares")
    app.include_router(share.me_v1_router, prefix="/api/v1/me")
    with TestClient(app) as client:
        yield client, database


def auth(user_id="user_alice"):
    return {"Authorization": f"Bearer {mint_token(PRIVATE_KEY, sub=user_id)}"}


def share_body(**overrides):
    return {
        "session_id": "session-alice",
        "question": "When is the deadline?",
        "answer": "The deadline is 30 June.",
        **overrides,
    }


def test_authenticated_owner_creates_share_from_persisted_answer(setup):
    client, database = setup
    response = client.post("/api/share", json=share_body(), headers=auth())
    assert response.status_code == 200
    slug = response.json()["slug"]
    stored = next(row for row in database.tables[shared_answers.TABLE] if row["slug"] == slug)
    assert stored["user_id"] == "user_alice"
    assert stored["answer"] == "The deadline is 30 June."
    assert stored["sources"] == database.tables[shared_answers.CHAT_TABLE][0]["sources"]
    assert stored["confidence"] == 0.87
    assert stored["confidence_label"] == ""
    assert "agency" not in stored or stored["agency"] == ""
    assert database.accesses == [False, False]


def test_missing_or_anonymous_identity_cannot_create_share(setup):
    client, database = setup
    response = client.post("/api/share", json=share_body())
    assert response.status_code == 401
    assert database.accesses == []


def test_forged_owner_is_rejected(setup):
    client, database = setup
    response = client.post(
        "/api/share", json=share_body(user_id="user_bob"), headers=auth()
    )
    assert response.status_code == 422
    assert database.accesses == []
    assert database.tables[shared_answers.TABLE] == []


def test_caller_evidence_and_confidence_fields_are_ignored(setup):
    client, database = setup
    response = client.post(
        "/api/share",
        json=share_body(
            sources=[{"document_id": "forged", "text": "fake citation"}],
            confidence=1.0,
            confidence_label="high",
            agency="Official Ministry",
        ),
        headers=auth(),
    )
    assert response.status_code == 200
    row = database.tables[shared_answers.TABLE][0]
    assert row["sources"] == database.tables[shared_answers.CHAT_TABLE][0]["sources"]
    assert row["confidence"] == 0.87
    assert row["confidence_label"] == ""
    assert row["agency"] == ""


def test_caller_verification_flag_is_rejected(setup):
    client, database = setup
    response = client.post(
        "/api/share", json=share_body(verified=True), headers=auth()
    )
    assert response.status_code == 422
    assert database.tables[shared_answers.TABLE] == []


def test_answer_must_match_server_saved_owner_record(setup):
    client, database = setup
    response = client.post(
        "/api/share",
        json=share_body(answer="Forged answer with fabricated facts."),
        headers=auth(),
    )
    assert response.status_code == 404
    assert database.tables[shared_answers.TABLE] == []
    assert database.accesses == [False]


def test_another_user_cannot_revoke_owner_share_and_does_not_acquire_admin(setup):
    client, database = setup
    database.tables[shared_answers.TABLE].append({
        "slug": "owner-share", "user_id": "user_alice", "question": "Q", "answer": "A",
        "sources": [], "language": "en", "created_at": "2026-10-30T12:00:00Z",
    })
    response = client.delete("/api/share/owner-share", headers=auth("user_bob"))
    assert response.status_code == 403
    assert database.accesses == [False]
    assert any(row["slug"] == "owner-share" for row in database.tables[shared_answers.TABLE])


def test_owner_revocation_uses_slug_and_owner_predicate_then_public_link_is_gone(setup):
    client, database = setup
    database.tables[shared_answers.TABLE].append({
        "slug": "owner-share", "user_id": "user_alice", "question": "Q", "answer": "A",
        "sources": [], "language": "en", "created_at": "2026-10-30T12:00:00Z",
    })
    response = client.delete("/api/share/owner-share", headers=auth())
    assert response.status_code == 200
    assert (shared_answers.TABLE, "delete", [("slug", "owner-share"), ("user_id", "user_alice")]) in database.queries
    assert client.get("/api/share/owner-share").status_code == 404


def test_public_share_retrieval_remains_available_including_legacy_ownerless_share(setup):
    client, database = setup
    database.tables[shared_answers.TABLE].append({
        "slug": "legacy-public", "question": "Q", "answer": "A", "sources": [],
        "language": "ms", "created_at": "2026-10-30T12:00:00Z",
    })
    response = client.get("/api/share/legacy-public")
    assert response.status_code == 200
    assert response.json()["answer"] == "A"
    assert response.headers["cache-control"] == "no-store, private"
    assert response.json()["sources"] == []
    assert response.json()["evidence_linked"] is False


def test_public_retrieval_ignores_legacy_caller_supplied_evidence_fields(setup, monkeypatch):
    client, database = setup
    monkeypatch.setattr(share, "_eligible_share_sources", lambda sources: sources)
    database.tables[shared_answers.TABLE].append({
        "slug": "old-share", "user_id": "user_alice",
        "question": "When is the deadline?", "answer": "The deadline is 30 June.",
        "sources": [{"document_id": "forged", "text": "fake"}], "language": "zh",
        "confidence": 1.0, "confidence_label": "high", "agency": "Fake Agency",
        "created_at": "2026-10-30T12:00:00Z",
    })
    response = client.get("/api/share/old-share")
    assert response.status_code == 200
    body = response.json()
    assert body["sources"] == database.tables[shared_answers.CHAT_TABLE][0]["sources"]
    assert body["confidence"] == 0.87
    assert body["confidence_label"] == ""
    assert body["agency"] == ""
    assert body["evidence_linked"] is True


def test_ownerless_legacy_share_cannot_be_revoked(setup):
    client, database = setup
    database.tables[shared_answers.TABLE].append({
        "slug": "legacy-public", "question": "Q", "answer": "A", "sources": [],
        "language": "ms", "created_at": "2026-10-30T12:00:00Z",
    })
    response = client.delete("/api/share/legacy-public", headers=auth())
    assert response.status_code == 403
    assert database.accesses == [False]


def test_share_insert_failure_does_not_retry_without_ownership(setup):
    client, database = setup
    database.fail_owned_share_insert = True
    response = client.post("/api/share", json=share_body(), headers=auth())
    assert response.status_code == 500
    share_inserts = [
        query for query in database.queries
        if query[0] == shared_answers.TABLE and query[1] == "insert"
    ]
    assert len(share_inserts) == 1
    assert database.tables[shared_answers.TABLE] == []


def test_share_has_no_modify_route(setup):
    client, database = setup
    response = client.patch("/api/share/owner-share", headers=auth(), json={"answer": "changed"})
    assert response.status_code == 405
    assert database.tables[shared_answers.TABLE] == []


def test_v1_public_share_read_preserves_no_store_and_public_link_behavior(setup):
    client, database = setup
    database.tables[shared_answers.TABLE].append({
        "slug": "v1-public", "question": "Q", "answer": "A", "sources": [],
        "language": "en", "created_at": "2026-10-30T12:00:00Z",
    })

    response = client.get("/api/v1/public/shares/v1-public")

    assert response.status_code == 200
    assert response.json()["answer"] == "A"
    assert response.headers["cache-control"] == "no-store, private"


def test_v1_share_list_and_revoke_require_clerk_owner(setup):
    client, database = setup
    database.tables[shared_answers.TABLE].append({
        "slug": "v1-owner", "user_id": "user_alice", "question": "Q", "answer": "A",
        "sources": [], "language": "en", "created_at": "2026-10-30T12:00:00Z",
    })

    anonymous_list = client.get("/api/v1/me/shares")
    foreign_revoke = client.delete("/api/v1/me/shares/v1-owner", headers=auth("user_bob"))
    owned_list = client.get("/api/v1/me/shares", headers=auth("user_alice"))
    owned_revoke = client.delete("/api/v1/me/shares/v1-owner", headers=auth("user_alice"))

    assert anonymous_list.status_code == 401
    assert foreign_revoke.status_code == 403
    assert owned_list.status_code == 200
    assert [item["slug"] for item in owned_list.json()] == ["v1-owner"]
    assert owned_revoke.status_code == 200
    assert not any(row.get("slug") == "v1-owner" for row in database.tables[shared_answers.TABLE])


def test_v1_share_creation_reuses_owned_persisted_answer_validation(setup):
    client, database = setup

    response = client.post("/api/v1/me/shares", json=share_body(), headers=auth("user_alice"))

    assert response.status_code == 200
    stored = next(
        row for row in database.tables[shared_answers.TABLE]
        if row["slug"] == response.json()["slug"]
    )
    assert stored["user_id"] == "user_alice"
    assert stored["answer"] == "The deadline is 30 June."
    assert database.accesses == [False, False]
