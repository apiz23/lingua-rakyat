import logging
import os
from typing import Any, Optional

from supabase import Client, create_client

logger = logging.getLogger("chat_history")

CHAT_HISTORY_TABLE = os.getenv("CHAT_HISTORY_TABLE", "lr_chat_messages")

_supabase: Optional[Client] = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in your .env file.")
        _supabase = create_client(url, key)
    return _supabase


def list_chat_messages(document_id: Optional[str] = None, session_id: Optional[str] = None) -> list[dict[str, Any]]:
    try:
        query = get_supabase().table(CHAT_HISTORY_TABLE).select("*")
        if document_id:
            query = query.eq("document_id", document_id)
        if session_id:
            query = query.eq("session_id", session_id)

        response = query.order("created_at", desc=True).execute()
        rows = response.data or []
        logger.info(
            "[ChatHistory] Loaded %d rows for document_id=%s session_id=%s",
            len(rows), document_id, session_id,
        )
        return rows
    except Exception as exc:
        logger.warning("[ChatHistory] Failed to load history: %s", exc)
        return []


def insert_chat_message(payload: dict[str, Any]) -> bool:
    try:
        get_supabase().table(CHAT_HISTORY_TABLE).insert(payload).execute()
        logger.info(
            "[ChatHistory] Saved message for document_id=%s session_id=%s",
            payload.get("document_id"), payload.get("session_id"),
        )
        return True
    except Exception as exc:
        logger.warning("[ChatHistory] Failed to save message: %s", exc)
        return False


def delete_chat_messages_for_document(document_id: str) -> int:
    try:
        response = (
            get_supabase()
            .table(CHAT_HISTORY_TABLE)
            .delete()
            .eq("document_id", document_id)
            .execute()
        )
        deleted = len(response.data or [])
        logger.info("[ChatHistory] Deleted %d rows for document_id=%s", deleted, document_id)
        return deleted
    except Exception as exc:
        logger.warning("[ChatHistory] Failed to delete history for %s: %s", document_id, exc)
        return 0
