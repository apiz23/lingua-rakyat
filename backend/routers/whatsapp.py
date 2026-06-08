"""
routers/whatsapp.py — WhatsApp Bot via Twilio Sandbox
=======================================================
Webhook endpoint Twilio calls on every incoming WhatsApp message.

Setup:
  1. Sign up at twilio.com (free trial)
  2. Console → Messaging → Try it out → Send a WhatsApp message → scan QR
  3. Set webhook URL in Twilio sandbox settings:
       https://<your-backend>/api/whatsapp/webhook
  4. Add to backend .env:
       TWILIO_ACCOUNT_SID=ACxxxxxxxx
       TWILIO_AUTH_TOKEN=xxxxxxxx

Supports:
  - Text messages → RAG Q&A
  - Document (PDF) messages → upload + confirm
  - Audio messages → transcribe → Q&A
  - "list" keyword → show available documents
  - "clear" keyword → reset session
"""

import logging
import os
import uuid
from io import BytesIO
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Form, Request, Response
from fastapi.responses import PlainTextResponse

logger = logging.getLogger("whatsapp_router")
router = APIRouter()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")

# ── In-memory sessions: phone_number → { document_id, doc_name, session_id, history }
_sessions: dict[str, dict] = {}


def _get_session(phone: str) -> dict:
    if phone not in _sessions:
        _sessions[phone] = {
            "document_id": None,
            "doc_name": "",
            "session_id": str(uuid.uuid4()),
            "user_id": f"wa_{phone.replace('+', '').replace('whatsapp:', '')}",
            "history": [],
        }
    return _sessions[phone]


def _twiml_reply(message: str) -> Response:
    """Return TwiML XML response Twilio uses to send a WhatsApp message."""
    safe = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{safe}</Message>
</Response>"""
    return Response(content=xml, media_type="application/xml")


def _fetch_twilio_media(media_url: str) -> bytes:
    """Download media from Twilio CDN (requires auth)."""
    resp = requests.get(media_url, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN), timeout=30)
    resp.raise_for_status()
    return resp.content


def _format_answer(result: dict) -> str:
    answer = result.get("answer", "No answer returned.")
    sources = result.get("sources", [])
    lang = result.get("language", "en")

    source_label = {"ms": "📄 Sumber", "zh-cn": "📄 来源"}.get(lang, "📄 Sources")
    confidence_emoji = {"high": "🟢", "medium": "🟡", "low": "🔴"}.get(
        result.get("confidence_label", ""), ""
    )

    source_line = ""
    if sources:
        top = sources[0]
        page = top.get("page_start", "?")
        doc = top.get("doc_name", "Document")
        score = top.get("score", 0)
        source_line = f"\n\n{source_label}: {doc}, pg {page} (score: {score:.2f})"

    return f"{answer}{source_line}\n{confidence_emoji}".strip()


def _list_documents() -> str:
    try:
        resp = requests.get(f"{BACKEND_URL}/api/documents/", timeout=10)
        resp.raise_for_status()
        docs = resp.json()
    except Exception as exc:
        logger.error("Failed to fetch docs: %s", exc)
        return "❌ Could not fetch documents."

    if not docs:
        return "No documents uploaded yet. Send a PDF to get started."

    lines = ["📂 *Available documents:*\n"]
    for i, doc in enumerate(docs[:10], 1):
        lines.append(f"{i}. {doc['name']}")
    lines.append("\nReply with the number to select a document.")
    return "\n".join(lines)


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(""),
    NumMedia: str = Form("0"),
    MediaUrl0: str = Form(""),
    MediaContentType0: str = Form(""),
):
    phone = From  # e.g. "whatsapp:+60123456789"
    session = _get_session(phone)
    text = Body.strip()
    num_media = int(NumMedia or 0)

    # ── PDF upload ────────────────────────────────────────────────────────────
    if num_media > 0 and "pdf" in MediaContentType0.lower():
        try:
            pdf_bytes = _fetch_twilio_media(MediaUrl0)
            filename = "document.pdf"

            resp = requests.post(
                f"{BACKEND_URL}/api/documents/upload",
                files={"file": (filename, BytesIO(pdf_bytes), "application/pdf")},
                data={"user_id": session["user_id"]},
                timeout=60,
            )
            resp.raise_for_status()
            result = resp.json()
            session["document_id"] = result["id"]
            session["doc_name"] = result["name"]
            session["history"] = []

            return _twiml_reply(
                f"✅ *{result['name']}* loaded!\n\nAsk me anything about this document in Malay, English, or Chinese."
            )
        except Exception as exc:
            logger.error("PDF upload failed: %s", exc)
            return _twiml_reply(f"❌ Upload failed: {exc}")

    # ── Audio message → STT → Q&A ─────────────────────────────────────────────
    if num_media > 0 and "audio" in MediaContentType0.lower():
        try:
            audio_bytes = _fetch_twilio_media(MediaUrl0)
            resp = requests.post(
                f"{BACKEND_URL}/api/voice/transcribe",
                files={"audio": ("voice.ogg", BytesIO(audio_bytes), "audio/ogg")},
                timeout=20,
            )
            resp.raise_for_status()
            transcript = resp.json().get("transcript", "").strip()
        except Exception as exc:
            logger.error("Transcription failed: %s", exc)
            return _twiml_reply(f"❌ Could not transcribe audio: {exc}")

        if not transcript:
            return _twiml_reply("Could not transcribe audio. Please try again.")

        text = transcript
        # fall through to text Q&A with transcribed text

    # ── "list" command ────────────────────────────────────────────────────────
    if text.lower() in ("list", "senarai", "列表", "/list", "/docs"):
        # Cache doc list for number selection
        try:
            resp = requests.get(f"{BACKEND_URL}/api/documents/", timeout=10)
            resp.raise_for_status()
            docs = resp.json()
            session["_doc_list"] = docs
        except Exception:
            docs = []
        return _twiml_reply(_list_documents())

    # ── Number selection (after "list") ───────────────────────────────────────
    if text.isdigit() and "_doc_list" in session:
        idx = int(text) - 1
        docs = session["_doc_list"]
        if 0 <= idx < len(docs):
            doc = docs[idx]
            session["document_id"] = doc["id"]
            session["doc_name"] = doc["name"]
            session["history"] = []
            session.pop("_doc_list", None)
            return _twiml_reply(f"✅ Selected: *{doc['name']}*\nNow ask your question.")
        return _twiml_reply("Invalid number. Send 'list' to see documents again.")

    # ── "clear" command ───────────────────────────────────────────────────────
    if text.lower() in ("clear", "reset", "/clear"):
        session["document_id"] = None
        session["doc_name"] = ""
        session["history"] = []
        return _twiml_reply("🗑️ Cleared. Send a PDF or 'list' to select a document.")

    # ── Text Q&A ──────────────────────────────────────────────────────────────
    if not session["document_id"]:
        return _twiml_reply(
            "Send a PDF to get started, or reply *list* to see available documents."
        )

    try:
        resp = requests.post(
            f"{BACKEND_URL}/api/chat/ask",
            json={
                "question": text,
                "document_id": session["document_id"],
                "document_name": session["doc_name"],
                "user_id": session["user_id"],
                "session_id": session["session_id"],
                "chat_history": session["history"][-6:],
            },
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
    except Exception as exc:
        logger.error("Q&A failed: %s", exc)
        return _twiml_reply(f"❌ Error: {exc}")

    session["history"].append({
        "question": text,
        "answer": result.get("answer", ""),
    })

    return _twiml_reply(_format_answer(result))
