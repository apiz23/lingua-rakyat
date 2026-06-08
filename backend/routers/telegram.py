"""
routers/telegram.py — Telegram Bot via Webhook (works on Vercel serverless)
============================================================================
Setup (one-time):
  1. Add BOT_TOKEN to backend env vars
  2. Deploy backend
  3. GET https://<your-backend>/api/telegram/setup  ← registers webhook with Telegram

Commands:
  /start  — welcome
  /docs   — list documents
  /clear  — reset session
"""

import logging
import os
import tempfile
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routers.documents import load_documents, sync_documents_with_storage, upsert_documents
from utils.rag_pipeline import answer_question, ingest_document
from utils.voice_helpers import transcribe_audio

logger = logging.getLogger("telegram_router")
router = APIRouter()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")


def _bot():
    from telegram import Bot
    return Bot(token=BOT_TOKEN)


def _supabase():
    from routers.documents import get_supabase
    return get_supabase()


# ── Supabase sessions ─────────────────────────────────────────────────────────

def _get_session(chat_id: str) -> dict:
    try:
        result = _supabase().table("lr_tg_sessions").select("*").eq("chat_id", chat_id).execute()
        if result.data:
            row = result.data[0]
            return {
                "document_id": row.get("document_id"),
                "doc_name": row.get("doc_name", ""),
                "session_id": row.get("session_id") or str(uuid.uuid4()),
                "user_id": f"tg_{chat_id}",
                "history": row.get("history") or [],
                "doc_map": row.get("doc_map") or {},
            }
    except Exception as exc:
        logger.warning("Session fetch failed: %s", exc)
    return {
        "document_id": None,
        "doc_name": "",
        "session_id": str(uuid.uuid4()),
        "user_id": f"tg_{chat_id}",
        "history": [],
        "doc_map": {},
    }


def _save_session(chat_id: str, session: dict) -> None:
    try:
        _supabase().table("lr_tg_sessions").upsert({
            "chat_id": chat_id,
            "document_id": session.get("document_id"),
            "doc_name": session.get("doc_name", ""),
            "session_id": session.get("session_id", ""),
            "history": session.get("history", [])[-6:],
            "doc_map": session.get("doc_map", {}),
        }).execute()
    except Exception as exc:
        logger.warning("Session save failed: %s", exc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_docs() -> list:
    try:
        docs = load_documents()
        return sync_documents_with_storage(docs)
    except Exception as exc:
        logger.error("Failed to fetch docs: %s", exc)
        return []


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
        source_line = (
            f"\n\n{source_label}: {top.get('doc_name', 'Document')}, "
            f"pg {top.get('page_start', '?')} (score: {top.get('score', 0):.2f})"
        )

    return f"{answer}{source_line}\n{confidence_emoji}".strip()


# ── Update handlers ───────────────────────────────────────────────────────────

async def _handle_message(bot, update) -> None:
    message = update.message
    if not message:
        return

    chat_id = str(message.chat_id)
    session = _get_session(chat_id)
    text = (message.text or "").strip()

    # ── /start ────────────────────────────────────────────────────────────────
    if text == "/start":
        await bot.send_message(
            chat_id=chat_id,
            text=(
                "👋 *Lingua Rakyat*\n\n"
                "Send me a Malaysian government PDF and I'll answer your questions "
                "in Malay, English, or Chinese.\n\n"
                "📎 Send a PDF or use /docs to pick an existing document."
            ),
            parse_mode="Markdown",
        )
        return

    # ── /clear ────────────────────────────────────────────────────────────────
    if text == "/clear":
        session["document_id"] = None
        session["doc_name"] = ""
        session["history"] = []
        _save_session(chat_id, session)
        await bot.send_message(chat_id=chat_id, text="🗑️ Cleared. Send a PDF or /docs to select one.")
        return

    # ── /docs ─────────────────────────────────────────────────────────────────
    if text == "/docs":
        docs = _get_docs()
        if not docs:
            await bot.send_message(chat_id=chat_id, text="No documents uploaded yet.")
            return

        doc_map = {doc["id"]: doc["name"] for doc in docs[:10]}
        session["doc_map"] = doc_map
        _save_session(chat_id, session)

        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        keyboard = [
            [InlineKeyboardButton(doc["name"][:40], callback_data=f"sel:{doc['id'][:50]}")]
            for doc in docs[:10]
        ]
        await bot.send_message(
            chat_id=chat_id,
            text="Select a document:",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
        return

    # ── PDF upload ────────────────────────────────────────────────────────────
    if message.document and message.document.file_name.lower().endswith(".pdf"):
        await bot.send_message(chat_id=chat_id, text="⏳ Processing...")
        try:
            tg_file = await bot.get_file(message.document.file_id)
            buf = await tg_file.download_as_bytearray()

            doc_id = str(uuid.uuid4())
            doc_name = message.document.file_name

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(buf)
                tmp_path = tmp.name

            try:
                chunk_count, _ = ingest_document(tmp_path, doc_id, doc_name)
                upsert_documents([{
                    "id": doc_id, "name": doc_name,
                    "size_bytes": message.document.file_size or 0,
                    "chunk_count": chunk_count, "status": "ready",
                    "uploaded_at": "", "storage_path": "", "public_url": "",
                }])
            finally:
                os.unlink(tmp_path)

            session["document_id"] = doc_id
            session["doc_name"] = doc_name
            session["history"] = []
            _save_session(chat_id, session)

            await bot.send_message(
                chat_id=chat_id,
                text=f"✅ *{doc_name}* loaded.\n\nAsk anything in Malay, English, or Chinese.",
                parse_mode="Markdown",
            )
        except Exception as exc:
            logger.error("PDF upload failed: %s", exc)
            await bot.send_message(chat_id=chat_id, text=f"❌ Upload failed: {exc}")
        return

    # ── Voice ─────────────────────────────────────────────────────────────────
    if message.voice:
        await bot.send_message(chat_id=chat_id, text="🎤 Transcribing...")
        try:
            tg_file = await bot.get_file(message.voice.file_id)
            audio_bytes = bytes(await tg_file.download_as_bytearray())
            result = transcribe_audio(audio_bytes, "voice.ogg")
            text = result.get("transcript", "").strip()
            if not text:
                await bot.send_message(chat_id=chat_id, text="Could not transcribe. Try again.")
                return
            await bot.send_message(chat_id=chat_id, text=f"🎤 *Heard:* {text}", parse_mode="Markdown")
        except Exception as exc:
            logger.error("Transcription failed: %s", exc)
            await bot.send_message(chat_id=chat_id, text=f"❌ Transcription failed: {exc}")
            return

    # ── Text Q&A ──────────────────────────────────────────────────────────────
    if not text:
        return

    if not session["document_id"]:
        await bot.send_message(chat_id=chat_id, text="Send a PDF first, or /docs to select a document.")
        return

    await bot.send_chat_action(chat_id=chat_id, action="typing")

    try:
        result = answer_question(
            question=text,
            document_id=session["document_id"],
            chat_history=session["history"][-6:] or None,
        )
    except Exception as exc:
        logger.error("Q&A failed: %s", exc)
        await bot.send_message(chat_id=chat_id, text=f"❌ Error: {exc}")
        return

    session["history"].append({"question": text, "answer": result.get("answer", "")})
    _save_session(chat_id, session)

    await bot.send_message(chat_id=chat_id, text=_format_answer(result))


async def _handle_callback(bot, update) -> None:
    query = update.callback_query
    if not query:
        return

    await bot.answer_callback_query(callback_query_id=query.id)
    chat_id = str(query.message.chat_id)
    session = _get_session(chat_id)

    if query.data.startswith("sel:"):
        doc_id = query.data.split(":", 1)[1]
        doc_name = session.get("doc_map", {}).get(doc_id, doc_id)
        session["document_id"] = doc_id
        session["doc_name"] = doc_name
        session["history"] = []
        _save_session(chat_id, session)

        await bot.edit_message_text(
            chat_id=chat_id,
            message_id=query.message.message_id,
            text=f"✅ Selected: *{doc_name}*\nNow ask your question.",
            parse_mode="Markdown",
        )


# ── Webhook endpoint ──────────────────────────────────────────────────────────

@router.post("/webhook")
async def telegram_webhook(request: Request):
    if not BOT_TOKEN:
        return JSONResponse({"error": "BOT_TOKEN not set"}, status_code=500)

    try:
        from telegram import Update
        data = await request.json()
        bot = _bot()
        update = Update.de_json(data, bot)

        if update.message:
            await _handle_message(bot, update)
        elif update.callback_query:
            await _handle_callback(bot, update)

    except Exception as exc:
        logger.error("Webhook error: %s", exc)

    return JSONResponse({"ok": True})


# ── Setup endpoint (call once after deploy) ───────────────────────────────────

@router.get("/setup")
async def setup_webhook(request: Request):
    if not BOT_TOKEN:
        return JSONResponse({"error": "BOT_TOKEN not set"}, status_code=500)

    base_url = str(request.base_url).rstrip("/")
    webhook_url = f"{base_url}/api/telegram/webhook"

    bot = _bot()
    await bot.set_webhook(url=webhook_url)

    return JSONResponse({"ok": True, "webhook_url": webhook_url})
