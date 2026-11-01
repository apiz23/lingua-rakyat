import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


def _make_client():
    from main import app
    return TestClient(app)


def test_feedback_up_returns_ok():
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
    with patch("routers.feedback.get_supabase", return_value=mock_sb):
        client = _make_client()
        resp = client.post("/api/feedback", json={
            "session_id": "sess-abc",
            "question": "What is MyKad?",
            "doc_id": "doc-123",
            "feedback": "up",
        })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_feedback_down_returns_ok():
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
    with patch("routers.feedback.get_supabase", return_value=mock_sb):
        client = _make_client()
        resp = client.post("/api/feedback", json={
            "session_id": "sess-xyz",
            "question": "KWSP withdrawal age?",
            "doc_id": "doc-456",
            "feedback": "down",
        })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_feedback_invalid_value_rejected():
    client = _make_client()
    resp = client.post("/api/feedback", json={
        "session_id": "sess-abc",
        "question": "Test",
        "doc_id": "doc-123",
        "feedback": "maybe",
    })
    assert resp.status_code == 422


def test_feedback_db_failure_returns_service_unavailable():
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception("DB down")
    with patch("routers.feedback.get_supabase", return_value=mock_sb):
        client = _make_client()
        resp = client.post("/api/feedback", json={
            "session_id": "sess-abc",
            "question": "Test",
            "doc_id": "doc-123",
            "feedback": "up",
        })
    assert resp.status_code == 503
    assert resp.json()["detail"] == "Feedback service unavailable"


def test_v1_public_feedback_uses_same_persistence_contract():
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
    with patch("routers.feedback.get_supabase", return_value=mock_sb):
        client = _make_client()
        resp = client.post("/api/v1/public/feedback", json={
            "session_id": "sess-v1",
            "question": "How do I apply?",
            "doc_id": "doc-v1",
            "feedback": "up",
        })

    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    mock_sb.table.assert_called_once_with("lr_feedback")
