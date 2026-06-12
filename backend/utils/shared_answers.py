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
"""

import logging
import os
import secrets
from typing import Any, Optional

from supabase import Client, create_client

logger = logging.getLogger("shared_answers")
TABLE = "lr_shared_answers"

_supabase: Optional[Client] = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set.")
        _supabase = create_client(url, key)
    return _supabase


def store_share(
    question: str,
    answer: str,
    sources: list[dict],
    language: str,
) -> str:
    slug = secrets.token_urlsafe(12)  # 72-bit entropy — negligible collision risk
    payload = {
        "slug": slug,
        "question": question,
        "answer": answer,
        "sources": sources,
        "language": language,
    }
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
