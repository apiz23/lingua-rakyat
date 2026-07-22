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


def store_share(
    question: str,
    answer: str,
    sources: list[dict],
    language: str,
    confidence: float = 0.0,
    confidence_label: str = "",
    agency: str = "",
    user_id: Optional[str] = None,
) -> str:
    slug = secrets.token_urlsafe(12)  # 72-bit entropy — negligible collision risk
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
    if user_id:
        payload["user_id"] = user_id
    try:
        res = get_supabase().table(TABLE).insert(payload).execute()
    except Exception as exc:
        if "user_id" not in payload:
            raise
        # Pre-migration tolerance: retry without the ownership column.
        logger.warning("[Share] Insert with user_id failed (%s); retrying without owner", exc)
        payload.pop("user_id")
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


def delete_share(slug: str) -> bool:
    res = get_supabase(admin=True).table(TABLE).delete().eq("slug", slug).execute()
    return bool(res.data)
