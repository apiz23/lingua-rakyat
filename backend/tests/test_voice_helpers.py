import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
from utils.voice_helpers import transcribe_audio, text_to_speech


# ── transcribe_audio ─────────────────────────────────────────────────────────

def test_transcribe_audio_returns_transcript_and_language():
    mock_response = MagicMock()
    mock_response.text = "Berapa umur untuk mengeluarkan KWSP?"
    mock_response.language = "ms"
    mock_response.duration = 3.2

    with patch("utils.voice_helpers._groq_client") as mock_client:
        mock_client.audio.transcriptions.create.return_value = mock_response
        result = transcribe_audio(b"fake_audio_bytes", "recording.webm")

    assert result["transcript"] == "Berapa umur untuk mengeluarkan KWSP?"
    assert result["language"] == "ms"
    assert result["duration_s"] == 3.2


def test_transcribe_audio_raises_on_empty_bytes():
    from utils.voice_helpers import TranscriptionError
    try:
        transcribe_audio(b"", "recording.webm")
        assert False, "Expected TranscriptionError"
    except TranscriptionError as e:
        assert "empty" in str(e).lower()


def test_transcribe_audio_propagates_groq_error():
    from utils.voice_helpers import TranscriptionError
    with patch("utils.voice_helpers._groq_client") as mock_client:
        mock_client.audio.transcriptions.create.side_effect = Exception("groq down")
        try:
            transcribe_audio(b"some_audio", "recording.webm")
            assert False, "Expected TranscriptionError"
        except TranscriptionError:
            pass


# ── text_to_speech ────────────────────────────────────────────────────────────

def test_text_to_speech_returns_bytes():
    fake_audio = [b"chunk1", b"chunk2", b"chunk3"]

    with patch("utils.voice_helpers._elevenlabs_client") as mock_el:
        mock_el.text_to_speech.convert.return_value = iter(fake_audio)
        result = text_to_speech("Hello world")

    assert result == b"chunk1chunk2chunk3"


def test_text_to_speech_truncates_long_text():
    long_text = "x" * 6000
    captured = {}

    def fake_convert(**kwargs):
        captured["text"] = kwargs["text"]
        return iter([b"audio"])

    with patch("utils.voice_helpers._elevenlabs_client") as mock_el:
        mock_el.text_to_speech.convert.side_effect = fake_convert
        text_to_speech(long_text)

    assert len(captured["text"]) <= 4500


def test_text_to_speech_returns_none_on_quota_exceeded():
    from elevenlabs.core.api_error import ApiError

    with patch("utils.voice_helpers._elevenlabs_client") as mock_el:
        err = ApiError(status_code=429, body="quota exceeded")
        mock_el.text_to_speech.convert.side_effect = err
        result = text_to_speech("some text")

    assert result is None
