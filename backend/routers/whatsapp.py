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

from routers.documents import load_documents, sync_documents_with_storage
from utils.rag_pipeline import answer_question
from utils.voice_helpers import transcribe_audio

logger = logging.getLogger("whatsapp_router")
router = APIRouter()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")


# ── Supabase-backed sessions (survives Vercel serverless restarts) ────────────

def _supabase():
    from routers.documents import get_supabase
    return get_supabase()


def _get_session(phone: str) -> dict:
    try:
        result = _supabase().table("lr_wa_sessions").select("*").eq("phone", phone).execute()
        if result.data:
            row = result.data[0]
            return {
                "document_id": row.get("document_id"),
                "doc_name": row.get("doc_name", ""),
                "session_id": row.get("session_id") or str(uuid.uuid4()),
                "user_id": f"wa_{phone.replace('+', '').replace('whatsapp:', '')}",
                "history": row.get("history") or [],
            }
    except Exception as exc:
        logger.warning("Session fetch failed, using empty: %s", exc)
    return {
        "document_id": None,
        "doc_name": "",
        "session_id": str(uuid.uuid4()),
        "user_id": f"wa_{phone.replace('+', '').replace('whatsapp:', '')}",
        "history": [],
    }


def _save_session(phone: str, session: dict) -> None:
    try:
        _supabase().table("lr_wa_sessions").upsert({
            "phone": phone,
            "document_id": session.get("document_id"),
            "doc_name": session.get("doc_name", ""),
            "session_id": session.get("session_id", ""),
            "history": session.get("history", [])[-6:],
        }).execute()
    except Exception as exc:
        logger.warning("Session save failed: %s", exc)


def _twiml_reply(message: str) -> Response:
    """Return TwiML XML response Twilio uses to send a WhatsApp message."""
    # Strip markdown bold/italic that WhatsApp doesn't need via TwiML
    clean = message.replace("*", "").replace("_", " ").replace("`", "")
    # Truncate to WhatsApp's 4096 char limit
    clean = clean[:4000]
    # Escape XML special chars
    safe = (
        clean
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><![CDATA[{message[:4000]}]]></Message>
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

    note = ""
    if result.get("evidence_mode") in ("cautious", "insufficient"):
        sentence = result.get("confidence_explanation")
        if sentence:
            note = f"\n⚠ {sentence}"

    return f"{answer}{source_line}\n{confidence_emoji}{note}".strip()


def _get_documents() -> list:
    try:
        docs = load_documents()
        return sync_documents_with_storage(docs)
    except Exception as exc:
        logger.error("Failed to fetch docs: %s", exc)
        return []


def _list_documents() -> str:
    docs = _get_documents()
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
            import tempfile, os as _os
            from utils.rag_pipeline import ingest_document
            from routers.documents import upsert_documents

            doc_id = str(uuid.uuid4())
            doc_name = "whatsapp_upload.pdf"
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(pdf_bytes)
                tmp_path = tmp.name

            try:
                chunk_count, _ = ingest_document(tmp_path, doc_id, doc_name)
                upsert_documents([{
                    "id": doc_id, "name": doc_name,
                    "size_bytes": len(pdf_bytes), "chunk_count": chunk_count,
                    "status": "ready", "uploaded_at": "",
                    "storage_path": "", "public_url": "",
                }])
            finally:
                _os.unlink(tmp_path)

            session["document_id"] = doc_id
            session["doc_name"] = doc_name
            session["history"] = []
            _save_session(phone, session)

            return _twiml_reply(
                f"✅ *{doc_name}* loaded!\n\nAsk me anything about this document in Malay, English, or Chinese."
            )
        except Exception as exc:
            logger.error("PDF upload failed: %s", exc)
            return _twiml_reply(f"❌ Upload failed: {exc}")

    # ── Audio message → STT → Q&A ─────────────────────────────────────────────
    if num_media > 0 and "audio" in MediaContentType0.lower():
        try:
            audio_bytes = _fetch_twilio_media(MediaUrl0)
            result = transcribe_audio(audio_bytes, "voice.ogg")
            transcript = result.get("transcript", "").strip()
        except Exception as exc:
            logger.error("Transcription failed: %s", exc)
            return _twiml_reply(f"❌ Could not transcribe audio: {exc}")

        if not transcript:
            return _twiml_reply("Could not transcribe audio. Please try again.")

        text = transcript
        # fall through to text Q&A with transcribed text

    # ── "list" command ────────────────────────────────────────────────────────
    if text.lower() in ("list", "senarai", "列表", "/list", "/docs"):
        docs = _get_documents()
        session["_doc_list"] = docs
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
            _save_session(phone, session)
            return _twiml_reply(f"✅ Selected: {doc['name']}\nNow ask your question.")
        return _twiml_reply("Invalid number. Send 'list' to see documents again.")

    # ── "clear" command ───────────────────────────────────────────────────────
    if text.lower() in ("clear", "reset", "/clear"):
        session["document_id"] = None
        session["doc_name"] = ""
        session["history"] = []
        _save_session(phone, session)
        return _twiml_reply("🗑️ Cleared. Send a PDF or 'list' to select a document.")

    # ── Text Q&A ──────────────────────────────────────────────────────────────
    if not session["document_id"]:
        return _twiml_reply(
            "Send a PDF to get started, or reply *list* to see available documents."
        )

    try:
        result = answer_question(
            question=text,
            document_id=session["document_id"],
            chat_history=session["history"][-6:] or None,
        )
    except Exception as exc:
        logger.error("Q&A failed: %s", exc)
        return _twiml_reply(f"❌ Error: {exc}")

    session["history"].append({
        "question": text,
        "answer": result.get("answer", ""),
    })
    _save_session(phone, session)

    return _twiml_reply(_format_answer(result))
