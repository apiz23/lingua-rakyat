"""Chat boundaries: document eligibility, idempotency and SSE commit ordering."""

import json
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import chat
from utils import eligibility, idempotency
from utils.idempotency import RunClaim


def _app(verified=None):
    app = FastAPI()
    app.state.limiter = chat.limiter
    if verified is not None:
        app.dependency_overrides[chat.get_verified_user] = lambda: verified
    app.include_router(chat.router, prefix="/api/chat")
    return app


def _body(**overrides):
    body = {
        "user_id": "anon-browser-id",
        "document_id": "doc-1",
        "document_name": "Doc",
        "session_id": "s1",
        "question": "Who is eligible?",
    }
    body.update(overrides)
    return body


def _result():
    return {
        "answer": "Answer text",
        "sources": [{"text": "source", "document_id": "doc-1", "score": 0.9}],
        "language": "en",
    }


def test_eligibility_outage_returns_503_before_provider_work(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise eligibility.EligibilityUnavailable("registry down")

    monkeypatch.setattr(chat.eligibility, "load_documents_for_authorization", unavailable)
    monkeypatch.setattr(
        chat, "answer_question", lambda **_kwargs: pytest.fail("provider work ran")
    )

    with TestClient(_app()) as client:
        response = client.post("/api/chat/ask", json=_body())

    assert response.status_code == 503


def test_anonymous_ask_denies_private_document(monkeypatch):
    row = {
        "id": "doc-1",
        "owner_type": "citizen",
        "owner_id": "user_owner",
        "visibility_scope": "private",
        "publication_status": "draft",
    }
    snapshot = eligibility.EligibilitySnapshot(approved_sources={}, revisions_by_document={})
    monkeypatch.setattr(
        chat.eligibility,
        "load_documents_for_authorization",
        lambda _client, _ids: ({"doc-1": row}, snapshot),
    )
    monkeypatch.setattr(
        chat, "answer_question", lambda **_kwargs: pytest.fail("provider work ran")
    )

    with TestClient(_app()) as client:
        response = client.post("/api/chat/ask", json=_body())

    assert response.status_code == 404


def test_signed_in_owner_can_read_own_private_document(monkeypatch):
    row = {
        "id": "doc-1",
        "owner_type": "citizen",
        "owner_id": "user_owner",
        "visibility_scope": "private",
        "publication_status": "draft",
    }
    snapshot = eligibility.EligibilitySnapshot(approved_sources={}, revisions_by_document={})
    monkeypatch.setattr(
        chat.eligibility,
        "load_documents_for_authorization",
        lambda _client, _ids: ({"doc-1": row}, snapshot),
    )
    monkeypatch.setattr(chat, "answer_question", lambda **_kwargs: _result())
    monkeypatch.setattr(chat, "insert_chat_message", lambda _payload: True)
    monkeypatch.setattr(chat.evaluator, "record", lambda **_kwargs: None)

    with TestClient(_app(verified="user_owner")) as client:
        response = client.post("/api/chat/ask", json=_body())

    assert response.status_code == 200


def test_idempotent_replay_does_not_repeat_provider_work(monkeypatch):
    monkeypatch.setattr(chat, "_authorize_ask_documents", lambda verified, body: ([], {}))
    monkeypatch.setattr(
        chat,
        "_claim_idempotent_run",
        lambda verified, body: RunClaim(
            "replay",
            {
                "answer": "stored",
                "sources": [],
                "language": "en",
                "question": "Who is eligible?",
                "timestamp": "2026-11-03T00:00:00Z",
                "confidence": 0.9,
                "latency_ms": 1,
            },
        ),
    )
    monkeypatch.setattr(
        chat, "answer_question", lambda **_kwargs: pytest.fail("provider work repeated")
    )

    with TestClient(_app(verified="user_owner")) as client:
        response = client.post("/api/chat/ask", json=_body(idempotency_key="key-1"))

    assert response.status_code == 200
    assert response.json()["answer"] == "stored"


def test_anonymous_idempotency_key_is_rejected(monkeypatch):
    monkeypatch.setattr(chat, "_authorize_ask_documents", lambda verified, body: ([], {}))
    with TestClient(_app()) as client:
        response = client.post("/api/chat/ask", json=_body(idempotency_key="key-1"))

    assert response.status_code == 400


def test_idempotency_conflict_is_409(monkeypatch):
    monkeypatch.setattr(chat, "_authorize_ask_documents", lambda verified, body: ([], {}))

    def conflict(*_args, **_kwargs):
        return RunClaim("conflict")

    monkeypatch.setattr(chat.idempotency, "claim_run", conflict)
    monkeypatch.setattr(chat, "get_supabase", lambda **_kwargs: object())

    with TestClient(_app(verified="user_owner")) as client:
        response = client.post("/api/chat/ask", json=_body(idempotency_key="key-1"))

    assert response.status_code == 409


def test_idempotency_in_progress_is_409(monkeypatch):
    monkeypatch.setattr(chat, "_authorize_ask_documents", lambda verified, body: ([], {}))
    monkeypatch.setattr(
        chat.idempotency, "claim_run", lambda *_args, **_kwargs: RunClaim("in_progress")
    )
    monkeypatch.setattr(chat, "get_supabase", lambda **_kwargs: object())

    with TestClient(_app(verified="user_owner")) as client:
        response = client.post("/api/chat/ask", json=_body(idempotency_key="key-1"))

    assert response.status_code == 409


def test_sse_failure_emits_error_and_never_complete(monkeypatch):
    monkeypatch.setattr(chat, "_authorize_ask_documents", lambda verified, body: ([], {}))

    def broken_stream(**_kwargs):
        yield {"type": "token", "text": "provisional"}
        yield {"type": "complete", "answer": "final", "sources": [], "language": "en"}

    monkeypatch.setattr(chat, "stream_answer_question", broken_stream)
    monkeypatch.setattr(chat, "insert_chat_message", lambda _payload: False)

    with TestClient(_app(verified="user_owner")) as client:
        response = client.post("/api/chat/ask-stream", json=_body())

    assert response.status_code == 200
    payloads = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]
    types = [payload["type"] for payload in payloads]
    assert "error" in types
    assert "complete" not in types
    assert types.count("error") == 1


def test_sse_commits_idempotency_before_complete(monkeypatch):
    monkeypatch.setattr(chat, "_authorize_ask_documents", lambda verified, body: ([], {}))
    order = []

    def stream(**_kwargs):
        yield {"type": "complete", "answer": "final", "sources": [], "language": "en"}

    monkeypatch.setattr(chat, "stream_answer_question", stream)
    monkeypatch.setattr(chat, "insert_chat_message", lambda _payload: True)
    monkeypatch.setattr(chat.evaluator, "record", lambda **_kwargs: None)
    monkeypatch.setattr(chat, "_claim_idempotent_run", lambda verified, body: RunClaim("new"))
    monkeypatch.setattr(
        chat,
        "_complete_idempotent_run",
        lambda verified, body, response: order.append("commit"),
    )

    with TestClient(_app(verified="user_owner")) as client:
        response = client.post("/api/chat/ask-stream", json=_body(idempotency_key="key-1"))

    payloads = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]
    assert [payload["type"] for payload in payloads] == ["start", "complete"]
    assert order == ["commit"]
