"""
Lingua Rakyat — Telegram Bot
=============================
Wraps the existing FastAPI backend. No backend changes needed.

Setup:
  1. pip install -r requirements.txt
  2. Copy .env.example to .env and fill BOT_TOKEN
  3. python bot.py

Commands:
  /start  — welcome message
  /docs   — list uploaded documents
  /clear  — clear current document selection
"""

import logging
import os
import uuid
from io import BytesIO

import requests
from dotenv import load_dotenv
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
)
from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("lingua_bot")

BACKEND_URL = os.getenv("BACKEND_URL", "https://lingua-rakyat-ai.vercel.app")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# ── In-memory session store ──────────────────────────────────────────────────
# chat_id → { document_id, doc_name, session_id, user_id, history }
_sessions: dict[int, dict] = {}


def _get_session(chat_id: int) -> dict:
    if chat_id not in _sessions:
        _sessions[chat_id] = {
            "document_id": None,
            "doc_name": "",
            "session_id": str(uuid.uuid4()),
            "user_id": f"tg_{chat_id}",
            "history": [],
        }
    return _sessions[chat_id]


def _format_answer(result: dict) -> str:
    answer = result.get("answer", "No answer returned.")
    sources = result.get("sources", [])
    lang = result.get("language", "en")

    source_label = {
        "ms": "📄 Sumber",
        "zh-cn": "📄 来源",
    }.get(lang, "📄 Sources")

    if sources:
        top = sources[0]
        page = top.get("page_start", "?")
        doc = top.get("doc_name", "Document")
        score = top.get("score", 0)
        source_line = f"\n\n{source_label}: {doc}, pg {page} (score: {score:.2f})"
    else:
        source_line = ""

    confidence = result.get("confidence_label", "")
    confidence_emoji = {"high": "🟢", "medium": "🟡", "low": "🔴"}.get(confidence, "")

    return f"{answer}{source_line}\n{confidence_emoji} {confidence}".strip()


# ── /start ───────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 *Lingua Rakyat*\n\n"
        "Send me a Malaysian government PDF and I'll answer your questions "
        "in Malay, English, or Chinese.\n\n"
        "📎 Send a PDF to get started.",
        parse_mode="Markdown",
    )


# ── /clear ───────────────────────────────────────────────────────────────────

async def cmd_clear(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    session = _get_session(chat_id)
    session["document_id"] = None
    session["doc_name"] = ""
    session["history"] = []
    await update.message.reply_text("🗑️ Cleared. Send a new PDF to start again.")


# ── /docs ────────────────────────────────────────────────────────────────────

async def cmd_docs(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    session = _get_session(chat_id)
    user_id = session["user_id"]

    try:
        resp = requests.get(
            f"{BACKEND_URL}/api/documents/",
            timeout=10,
        )
        resp.raise_for_status()
        docs = resp.json()
    except Exception as exc:
        logger.error("Failed to fetch docs: %s", exc)
        await update.message.reply_text("❌ Could not fetch documents.")
        return

    if not docs:
        await update.message.reply_text("No documents uploaded yet. Send a PDF first.")
        return

    # Store doc list in chat_data so callback can look up name by id
    ctx.chat_data["doc_map"] = {doc["id"]: doc["name"] for doc in docs[:10]}

    keyboard = [
        [InlineKeyboardButton(doc["name"][:40], callback_data=f"sel:{doc['id'][:50]}")]
        for doc in docs[:10]
    ]
    await update.message.reply_text(
        "Select a document:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def handle_doc_selection(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    doc_id = query.data.split(":", 1)[1]
    doc_name = ctx.chat_data.get("doc_map", {}).get(doc_id, doc_id)

    chat_id = update.effective_chat.id
    session = _get_session(chat_id)
    session["document_id"] = doc_id
    session["doc_name"] = doc_name
    session["history"] = []

    await query.edit_message_text(f"✅ Selected: *{doc_name}*\nNow ask your question.", parse_mode="Markdown")


# ── PDF upload ───────────────────────────────────────────────────────────────

async def handle_pdf(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    session = _get_session(chat_id)
    doc = update.message.document

    if not doc.file_name.lower().endswith(".pdf"):
        await update.message.reply_text("Please send a PDF file.")
        return

    await update.message.reply_text("⏳ Uploading and processing...")

    try:
        tg_file = await doc.get_file()
        buf = BytesIO()
        await tg_file.download_to_memory(buf)
        buf.seek(0)

        resp = requests.post(
            f"{BACKEND_URL}/api/documents/upload",
            files={"file": (doc.file_name, buf, "application/pdf")},
            data={"user_id": session["user_id"]},
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
    except Exception as exc:
        logger.error("Upload failed: %s", exc)
        await update.message.reply_text(f"❌ Upload failed: {exc}")
        return

    session["document_id"] = result["id"]
    session["doc_name"] = result["name"]
    session["history"] = []

    await update.message.reply_text(
        f"✅ *{result['name']}* loaded.\n\nAsk me anything about this document — in Malay, English, or Chinese.",
        parse_mode="Markdown",
    )


# ── Text Q&A ─────────────────────────────────────────────────────────────────

async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    session = _get_session(chat_id)
    question = update.message.text.strip()

    if not session["document_id"]:
        await update.message.reply_text("Send a PDF first, or use /docs to select a document.")
        return

    await update.message.chat.send_action("typing")

    try:
        resp = requests.post(
            f"{BACKEND_URL}/api/chat/ask",
            json={
                "question": question,
                "document_id": session["document_id"],
                "document_name": session["doc_name"],
                "user_id": session["user_id"],
                "session_id": session["session_id"],
                "chat_history": session["history"][-6:],  # last 3 turns
            },
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
    except Exception as exc:
        logger.error("Q&A failed: %s", exc)
        await update.message.reply_text(f"❌ Error: {exc}")
        return

    # Append to multi-turn history
    session["history"].append({
        "question": question,
        "answer": result.get("answer", ""),
    })

    await update.message.reply_text(_format_answer(result))


# ── Voice message ─────────────────────────────────────────────────────────────

async def handle_voice(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    session = _get_session(chat_id)

    await update.message.reply_text("🎤 Transcribing...")

    try:
        tg_file = await update.message.voice.get_file()
        buf = BytesIO()
        await tg_file.download_to_memory(buf)
        buf.seek(0)

        resp = requests.post(
            f"{BACKEND_URL}/api/voice/transcribe",
            files={"audio": ("voice.ogg", buf, "audio/ogg")},
            timeout=20,
        )
        resp.raise_for_status()
        transcript = resp.json().get("transcript", "").strip()
    except Exception as exc:
        logger.error("Transcription failed: %s", exc)
        await update.message.reply_text(f"❌ Transcription failed: {exc}")
        return

    if not transcript:
        await update.message.reply_text("Could not transcribe audio. Try again.")
        return

    await update.message.reply_text(f"🎤 *Heard:* {transcript}", parse_mode="Markdown")

    # Reuse text handler logic
    update.message.text = transcript
    await handle_text(update, ctx)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    if not BOT_TOKEN:
        raise ValueError("BOT_TOKEN not set in .env")

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("clear", cmd_clear))
    app.add_handler(CommandHandler("docs", cmd_docs))
    app.add_handler(CallbackQueryHandler(handle_doc_selection, pattern=r"^sel:"))
    app.add_handler(MessageHandler(filters.Document.PDF, handle_pdf))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    logger.info("Bot started. Backend: %s", BACKEND_URL)
    app.run_polling()


if __name__ == "__main__":
    main()
