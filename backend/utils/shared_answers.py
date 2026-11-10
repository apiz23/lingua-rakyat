"""
Shared answers Supabase utility for storing and retrieving RAG responses.

The Supabase table must be created manually. Run once in Supabase SQL editor:

create table lr_shared_answers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  question text not null,
  answer text not null,
  sources jsonb not null default '[]',
  language text not null default 'ms',
  created_at timestamptz not null default now()
);

Migration for the receipt card fields (run once in Supabase SQL editor):

alter table lr_shared_answers
  add column if not exists confidence numeric not null default 0,
  add column if not exists confidence_label text not null default '',
  add column if not exists agency text not null default '';

Migration for share ownership (run once in Supabase SQL editor):

alter table lr_shared_answers add column if not exists user_id text;
create index if not exists idx_lr_shared_answers_user_id
  on lr_shared_answers(user_id);
"""

import logging
import os
import secrets
from typing import Any, Optional

from utils.auth import get_supabase

logger = logging.getLogger("shared_answers")
TABLE = "lr_shared_answers"
CHAT_TABLE = os.getenv("CHAT_HISTORY_TABLE", "lr_chat_messages")


def find_owned_chat_answer(
    *, user_id: str, question: str, answer: str, session_id: Optional[str] = None
) -> Optional[dict[str, Any]]:
    """Resolve share content only from an answer persisted for this owner/session."""
    if not user_id or not user_id.strip():
        raise ValueError("Verified owner is required")
    if session_id is not None and not session_id.strip():
        raise ValueError("Session cannot be empty")
    if not question or not question.strip() or not answer or not answer.strip():
        raise ValueError("Question and answer are required")
    try:
        query = (
            get_supabase().table(CHAT_TABLE)
            .select("user_id, session_id, question, answer, language, sources, confidence, created_at")
            .eq("user_id", user_id)
            .eq("question", question)
        )
        if session_id is not None:
            query = query.eq("session_id", session_id)
        response = query.order("created_at", desc=True).limit(20).execute()
        for row in response.data or []:
            if (
                row.get("user_id") == user_id
                and (session_id is None or row.get("session_id") == session_id)
                and row.get("question") == question
                and row.get("answer") == answer
            ):
                return row
        return None
    except Exception as exc:
        logger.warning("[Share] Could not resolve persisted answer")
        raise RuntimeError("Persisted answer lookup failed") from exc


def store_share(
    question: str,
    answer: str,
    sources: list[dict],
    language: str,
    user_id: str,
    confidence: float = 0.0,
    confidence_label: str = "",
    agency: str = "",
) -> str:
    if not user_id or not user_id.strip():
        raise ValueError("Verified share owner is required")
    slug = secrets.token_urlsafe(12)
    payload = {
        "slug": slug,
        "question": question,
        "answer": answer,
        "sources": sources,
        "language": language,
        "confidence": confidence,
        "confidence_label": confidence_label,
        "agency": agency,
    }
    payload["user_id"] = user_id
    res = get_supabase().table(TABLE).insert(payload).execute()
    if not res.data:
        raise RuntimeError(f"[Share] Insert returned no data for slug={slug}")
    logger.info("[Share] Stored slug=%s", slug)
    return slug


def get_share(slug: str) -> Optional[dict[str, Any]]:
    try:
        res = get_supabase().table(TABLE).select("*").eq("slug", slug).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("[Share] get_share failed for slug=%s: %s", slug, exc)
        return None


def list_shares_for_user(user_id: str) -> list[dict[str, Any]]:
    try:
        res = (
            get_supabase()
            .table(TABLE)
            .select("slug, question, confidence_label, agency, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        logger.warning("[Share] list_shares_for_user failed for %s: %s", user_id, exc)
        return []


def delete_share(slug: str, *, user_id: str) -> bool:
    if not user_id or not user_id.strip() or not slug or not slug.strip():
        raise ValueError("Share owner and slug are required")
    res = (
        get_supabase(admin=True)
        .table(TABLE)
        .delete()
        .eq("slug", slug)
        .eq("user_id", user_id)
        .select("slug")
        .execute()
    )
    return bool(res.data)
