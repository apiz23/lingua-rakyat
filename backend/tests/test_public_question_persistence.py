import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import chat


@pytest.fixture
def client():
    app = FastAPI()
    app.state.limiter = chat.limiter
    app.include_router(chat.router, prefix="/api/chat")
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def answer_result():
    return {
        "answer": "Check the official eligibility rules.",
        "sources": [{"text": "Eligibility information", "document_id": "public-doc", "score": 0.8}],
        "language": "en",
    }


def anonymous_body():
    return {
        "user_id": "browser-generated-anonymous-id",
        "session_id": "browser-generated-session-id",
        "document_id": "public-doc",
        "document_name": "Public document",
        "question": "Who is eligible?",
    }


def test_anonymous_buffered_question_is_answered_without_persistence_or_eval(
    client, monkeypatch, answer_result
):
    monkeypatch.setattr(chat, "answer_question", lambda **_kwargs: answer_result)
    monkeypatch.setattr(chat, "insert_chat_message", lambda *_args: pytest.fail("anonymous history persisted"))
    monkeypatch.setattr(chat, "_record_eval", lambda *_args: pytest.fail("anonymous Q&A copied to evaluation"))

    response = client.post("/api/chat/ask", json=anonymous_body())

    assert response.status_code == 200
    assert response.json()["answer"] == answer_result["answer"]


def test_anonymous_streaming_question_is_answered_without_persistence_or_eval(
    client, monkeypatch
):
    events = [
        {"type": "token", "text": "Provisional text"},
        {
            "type": "complete",
            "answer": "Verified final text",
            "sources": [{"text": "Source passage", "document_id": "public-doc", "score": 0.9}],
            "language": "en",
        },
    ]
    monkeypatch.setattr(chat, "stream_answer_question", lambda **_kwargs: iter(events))
    monkeypatch.setattr(chat, "insert_chat_message", lambda *_args: pytest.fail("anonymous history persisted"))
    monkeypatch.setattr(chat, "_record_eval", lambda *_args: pytest.fail("anonymous Q&A copied to evaluation"))

    response = client.post("/api/chat/ask-stream", json=anonymous_body())

    assert response.status_code == 200
    assert '"type": "complete"' in response.text
    assert "Verified final text" in response.text


def test_signed_in_streaming_question_persists_final_answer_for_verified_owner(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    captured = []
    metric_records = []
    monkeypatch.setattr(chat, "insert_chat_message", lambda payload: captured.append(payload) or True)
    monkeypatch.setattr(chat.evaluator, "record", lambda **kwargs: metric_records.append(kwargs))
    monkeypatch.setattr(
        chat,
        "stream_answer_question",
        lambda **_kwargs: iter([
            {"type": "token", "text": "Provisional text"},
            {
                "type": "complete",
                "answer": "Verified final text",
                "sources": [{"text": "Source passage", "document_id": "doc-a", "score": 0.9}],
                "language": "en",
            },
        ]),
    )
    app = FastAPI()
    app.state.limiter = chat.limiter
    app.dependency_overrides[chat.get_verified_user] = lambda: "user_alice"
    app.include_router(chat.router, prefix="/api/chat")

    with TestClient(app) as test_client:
        response = test_client.post("/api/chat/ask-stream", json=anonymous_body())

    assert response.status_code == 200
    assert len(captured) == 1
    assert captured[0]["user_id"] == "user_alice"
    assert captured[0]["answer"] == "Verified final text"
    assert len(metric_records) == 1
