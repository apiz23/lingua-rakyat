"""
routers/voice.py — Voice I/O endpoints: STT (Groq Whisper) + TTS (ElevenLabs).
"""
import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from utils.voice_helpers import TranscriptionError, text_to_speech, transcribe_audio

logger = logging.getLogger("voice_router")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

MIN_AUDIO_BYTES = 1  # reject truly empty uploads


class TTSRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "en"


# ── /transcribe ───────────────────────────────────────────────────────────────

@router.post("/transcribe")
@limiter.limit("10/minute")
async def transcribe(request: Request, audio: UploadFile = File(...)):
    """
    Receive WebM/Opus audio from browser MediaRecorder.
    Returns { transcript, language, duration_s }.
    """
    audio_bytes = await audio.read()

    if len(audio_bytes) < MIN_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="empty audio: no bytes received")

    try:
        result = transcribe_audio(audio_bytes, audio.filename or "recording.webm")
    except TranscriptionError as exc:
        logger.warning("Transcription failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return result


# ── /tts ──────────────────────────────────────────────────────────────────────

@router.post("/tts")
@limiter.limit("10/minute")
async def tts(request: Request, body: TTSRequest):
    """
    Convert text to speech via ElevenLabs multilingual v2.
    Returns audio/mpeg on success, or { fallback: true } if quota exceeded.
    """
    audio_bytes = text_to_speech(body.text)

    if audio_bytes is None:
        # ElevenLabs quota exceeded — tell frontend to use speechSynthesis
        return JSONResponse(content={"fallback": True})

    return Response(content=audio_bytes, media_type="audio/mpeg")
