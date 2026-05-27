import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch
from fastapi.testclient import TestClient


def _make_client():
    """Import app fresh so env is loaded."""
    from main import app
    return TestClient(app)


def test_transcribe_returns_transcript():
    fake_result = {"transcript": "Apa syarat KWSP?", "language": "ms", "duration_s": 2.1}
    with patch("routers.voice.transcribe_audio", return_value=fake_result):
        client = _make_client()
        audio_bytes = b"fake_webm_audio_data"
        resp = client.post(
            "/api/voice/transcribe",
            files={"audio": ("recording.webm", audio_bytes, "audio/webm")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["transcript"] == "Apa syarat KWSP?"
    assert data["language"] == "ms"


def test_transcribe_rejects_empty_file():
    client = _make_client()
    resp = client.post(
        "/api/voice/transcribe",
        files={"audio": ("recording.webm", b"", "audio/webm")},
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


def test_tts_returns_audio_bytes():
    fake_audio = b"\xff\xfbfake_mp3_data"
    with patch("routers.voice.text_to_speech", return_value=fake_audio):
        client = _make_client()
        resp = client.post(
            "/api/voice/tts",
            json={"text": "Anda perlu berumur 55 tahun.", "language": "ms"},
        )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert resp.content == fake_audio


def test_tts_returns_fallback_on_quota():
    with patch("routers.voice.text_to_speech", return_value=None):
        client = _make_client()
        resp = client.post(
            "/api/voice/tts",
            json={"text": "Some text", "language": "en"},
        )
    assert resp.status_code == 200
    assert resp.json() == {"fallback": True}


def test_tts_rejects_empty_text():
    client = _make_client()
    resp = client.post(
        "/api/voice/tts",
        json={"text": "", "language": "en"},
    )
    assert resp.status_code == 422  # Pydantic validation


def test_transcribe_returns_422_on_transcription_error():
    from utils.voice_helpers import TranscriptionError
    with patch("routers.voice.transcribe_audio", side_effect=TranscriptionError("groq down")):
        client = _make_client()
        audio_bytes = b"fake_webm_audio_data"
        resp = client.post(
            "/api/voice/transcribe",
            files={"audio": ("recording.webm", audio_bytes, "audio/webm")},
        )
    assert resp.status_code == 422
    assert "groq down" in resp.json()["detail"]
