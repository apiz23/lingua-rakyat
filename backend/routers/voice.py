"""
routers/voice.py — Voice I/O endpoints: STT (Groq Whisper) + TTS (ElevenLabs).
"""
import asyncio
import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from slowapi import Limiter

from rate_limits import VOICE_LIMIT, get_proxy_aware_remote_address
from utils.voice_helpers import TranscriptionError, MAX_TTS_CHARS, text_to_speech, transcribe_audio

logger = logging.getLogger("voice_router")
limiter = Limiter(key_func=get_proxy_aware_remote_address)
router = APIRouter()
public_v1_router = APIRouter()

MIN_AUDIO_BYTES = 1
MAX_AUDIO_BYTES = 10 * 1024 * 1024
# Multipart framing adds a small amount on top of the file itself.
_MULTIPART_OVERHEAD_BYTES = 64 * 1024


class TTSRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "en"




@router.post("/transcribe")
@limiter.limit(VOICE_LIMIT)
async def transcribe(request: Request, audio: UploadFile = File(...)):
    """
    Receive WebM/Opus audio from browser MediaRecorder.
    Returns { transcript, language, duration_s }.
    """
    declared = (request.headers.get("content-length") or "").strip()
    if declared.isdigit() and int(declared) > MAX_AUDIO_BYTES + _MULTIPART_OVERHEAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Audio file is too large. Maximum size is 10 MB.",
        )

    audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Audio file is too large. Maximum size is 10 MB.",
        )

    if len(audio_bytes) < MIN_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="empty audio: no bytes received")

    try:
        # Groq transcription is a blocking HTTP call; keep it off the event loop.
        result = await asyncio.to_thread(
            transcribe_audio, audio_bytes, audio.filename or "recording.webm"
        )
    except TranscriptionError as exc:
        logger.warning("Transcription failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return result




@router.post("/tts")
@limiter.limit(VOICE_LIMIT)
def tts(request: Request, body: TTSRequest):
    """
    Convert text to speech via ElevenLabs multilingual v2.
    Returns audio/mpeg on success, or { fallback: true } if quota exceeded.
    """
    audio_bytes = text_to_speech(body.text, body.language)

    if audio_bytes is None:

        return JSONResponse(content={"fallback": True})

    extra_headers = {"X-TTS-Truncated": "true"} if len(body.text) > MAX_TTS_CHARS else {}
    return Response(content=audio_bytes, media_type="audio/mpeg", headers=extra_headers)





public_v1_router.add_api_route(
    "/transcriptions",
    transcribe,
    methods=["POST"],
    name="public_transcribe_v1",
)
public_v1_router.add_api_route(
    "/speech",
    tts,
    methods=["POST"],
    name="public_tts_v1",
)
