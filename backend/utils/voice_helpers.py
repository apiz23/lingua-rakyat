"""
utils/voice_helpers.py — Groq Whisper STT + ElevenLabs TTS helpers.
"""
import io
import logging
import os

from dotenv import load_dotenv
from groq import Groq

try:
    from elevenlabs.client import ElevenLabs
    from elevenlabs.core.api_error import ApiError
except ImportError:
    ElevenLabs = None  # type: ignore[assignment,misc]
    ApiError = Exception  # type: ignore[assignment,misc]

load_dotenv()

logger = logging.getLogger("voice_helpers")

# ── Clients (module-level singletons) ────────────────────────────────────────
_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
_elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY")) if ElevenLabs is not None else None

# Male voice for English responses (default: Adam)
VOICE_ID_EN = os.getenv("ELEVENLABS_VOICE_ID_EN", os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB"))
# Female voice for Malay / other languages (default: Rachel)
VOICE_ID_MS = os.getenv("ELEVENLABS_VOICE_ID_MS", "21m00Tcm4TlvDq8ikWAM")
TTS_MODEL = "eleven_multilingual_v2"
WHISPER_MODEL = "whisper-large-v3"
MAX_TTS_CHARS = 4500


class TranscriptionError(Exception):
    """Raised when Groq Whisper transcription fails."""


# ── STT ───────────────────────────────────────────────────────────────────────

def transcribe_audio(audio_bytes: bytes, filename: str) -> dict:
    """
    Transcribe audio bytes using Groq Whisper.

    Args:
        audio_bytes: Raw audio data (WebM/Opus from browser MediaRecorder).
        filename: Original filename (used to hint MIME type to Groq).

    Returns:
        { "transcript": str, "language": str, "duration_s": float }

    Raises:
        TranscriptionError: On empty input or Groq API failure.
    """
    # Defensive guard — router rejects empty bytes at HTTP layer (400),
    # but this protects non-HTTP callers too.
    if not audio_bytes:
        raise TranscriptionError("empty audio: no bytes received")

    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename  # Groq uses filename to detect MIME type

        response = _groq_client.audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=audio_file,
            response_format="verbose_json",
        )
        return {
            "transcript": response.text,
            "language": response.language or "en",
            "duration_s": float(response.duration or 0.0),
        }
    except TranscriptionError:
        raise
    except Exception as exc:
        logger.error("Groq Whisper error: %s", exc)
        raise TranscriptionError(f"transcription failed: {exc}") from exc


# ── TTS ───────────────────────────────────────────────────────────────────────

_MALAY_LANGS = {"ms", "id"}

def _pick_voice(language: str) -> str:
    """Male for English, female for Malay/other languages."""
    return VOICE_ID_EN if language not in _MALAY_LANGS else VOICE_ID_MS


def text_to_speech(text: str, language: str = "en") -> bytes | None:
    """
    Convert text to speech using ElevenLabs multilingual v2.

    Args:
        text: Answer text to speak. Truncated to MAX_TTS_CHARS if too long.
        language: BCP-47 / langdetect code — used to select voice gender.

    Returns:
        audio/mpeg bytes on success.
        None if ElevenLabs quota is exceeded (HTTP 429).

    Raises:
        Exception: On unexpected ElevenLabs errors (not 429).
    """
    if len(text) > MAX_TTS_CHARS:
        logger.warning(
            "TTS text truncated from %d to %d chars", len(text), MAX_TTS_CHARS
        )
    text = text[:MAX_TTS_CHARS]

    try:
        audio_generator = _elevenlabs_client.text_to_speech.convert(
            voice_id=_pick_voice(language),
            text=text,
            model_id=TTS_MODEL,
        )
        return b"".join(audio_generator)
    except ApiError as exc:
        if exc.status_code == 429:
            logger.warning("ElevenLabs quota exceeded — falling back to browser TTS")
            return None
        raise
