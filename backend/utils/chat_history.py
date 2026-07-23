import logging
import os
from typing import Any, Optional

from utils.auth import get_supabase

logger = logging.getLogger("chat_history")

CHAT_HISTORY_TABLE = os.getenv("CHAT_HISTORY_TABLE", "lr_chat_messages")


def list_chat_messages(
    document_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    try:
        query = get_supabase().table(CHAT_HISTORY_TABLE).select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        if document_id:
            query = query.eq("document_id", document_id)
        if session_id:
            query = query.eq("session_id", session_id)

        response = query.order("created_at", desc=True).execute()
        rows = response.data or []
        logger.info(
            "[ChatHistory] Loaded %d rows for user_id=%s document_id=%s session_id=%s",
            len(rows), user_id, document_id, session_id,
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
        error_text = str(exc)
        if "schema cache" in error_text and "Could not find the '" in error_text:
            optional_fields = [
                "confidence_label",
                "model_used",
                "sufficient_evidence",
                "latency_ms",
                "document_name",
                "faithfulness",
            ]
            retry_payload = dict(payload)
            removed_any = False
            for field in optional_fields:
                if f"'{field}'" in error_text and field in retry_payload:
                    retry_payload.pop(field, None)
                    removed_any = True
            if removed_any:
                try:
                    get_supabase().table(CHAT_HISTORY_TABLE).insert(retry_payload).execute()
                    logger.info(
                        "[ChatHistory] Saved message after removing unsupported columns for document_id=%s session_id=%s",
                        retry_payload.get("document_id"),
                        retry_payload.get("session_id"),
                    )
                    return True
                except Exception as retry_exc:
                    logger.warning("[ChatHistory] Retry save failed: %s", retry_exc)
        logger.warning("[ChatHistory] Failed to save message: %s", exc)
        return False


def delete_chat_messages(
    *,
    document_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> int:
    try:
        query = get_supabase(admin=True).table(CHAT_HISTORY_TABLE).delete()
        if user_id:
            query = query.eq("user_id", user_id)
        if document_id:
            query = query.eq("document_id", document_id)
        if session_id:
            query = query.eq("session_id", session_id)

        response = query.execute()
        deleted = len(response.data or [])
        logger.info(
            "[ChatHistory] Deleted %d rows for user_id=%s document_id=%s session_id=%s",
            deleted,
            user_id,
            document_id,
            session_id,
        )
        return deleted
    except Exception as exc:
        logger.warning(
            "[ChatHistory] Failed to delete history for user_id=%s document_id=%s session_id=%s: %s",
            user_id,
            document_id,
            session_id,
            exc,
        )
        return 0


def delete_chat_messages_for_document(document_id: str) -> int:
    return delete_chat_messages(document_id=document_id)


def update_conversation_title(
    user_id: str, session_id: str, title: str
) -> bool:
    """Set a custom title for a conversation session."""
    try:
        payload = {"custom_title": title[:80]}
        supabase = get_supabase(admin=True)
        supabase.table(CHAT_HISTORY_TABLE).update(payload).eq(
            "session_id", session_id
        ).eq("user_id", user_id).execute()
        logger.info(
            "[ChatHistory] Renamed session_id=%s to %r", session_id, title
        )
        return True
    except Exception as exc:
        logger.warning(
            "[ChatHistory] Failed to rename session_id=%s: %s",
            session_id, exc,
        )
        return False


def list_conversations(user_id: str) -> list[dict[str, Any]]:
    """Group lr_chat_messages by session_id for the sidebar conversation list.

    Rows come back newest-first from list_chat_messages, so iterating and
    always overwriting `title` with the current row's question yields the
    oldest (first) question as the title when the loop finishes.

    If any message in the session has a `custom_title`, that is used instead.
    """
    rows = list_chat_messages(user_id=user_id)
    sessions: dict[str, dict] = {}
    for row in rows:
        sid = row.get("session_id", "")
        if not sid:
            continue
        q = (row.get("question") or "")[:80]
        ts = row.get("created_at", "")
        ct = row.get("custom_title")
        if sid not in sessions:
            sessions[sid] = {
                "session_id": sid,
                "title": q,
                "last_at": ts,
                "count": 0,
                "custom_title": ct,
            }
        sessions[sid]["count"] += 1
        sessions[sid]["title"] = q
        if ct and not sessions[sid].get("custom_title"):
            sessions[sid]["custom_title"] = ct
    return sorted(sessions.values(), key=lambda x: x["last_at"], reverse=True)
