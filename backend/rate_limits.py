"""
rate_limits.py — Centralized, env-gated rate-limit values.

All endpoints key by client IP (slowapi get_remote_address). At a demo booth,
every visitor shares one public IP, so the per-IP buckets fill quickly and
judges hit HTTP 429 mid-demo. Set BOOTH_MODE=true to switch to generous limits
for the controlled demo, then false again for normal public use.

Normal-mode values match the limits that were previously hard-coded on each
route, so behavior is unchanged unless BOOTH_MODE (or a per-limit override) is
set. Each value can be overridden directly with its own env var
(e.g. CHAT_RATE_LIMIT="500/minute"), which takes precedence over BOOTH_MODE.
"""

import os

BOOTH_MODE = os.getenv("BOOTH_MODE", "false").lower() == "true"


def _limit(env_key: str, normal: str, booth: str) -> str:
    override = os.getenv(env_key, "").strip()
    if override:
        return override
    return booth if BOOTH_MODE else normal


# Global default applied to every route via SlowAPIMiddleware (main.py).
GLOBAL_DEFAULT = _limit("GLOBAL_RATE_LIMIT", "200/minute", "2000/minute")

# Chat Q&A (ask + ask-stream).
CHAT_LIMIT = _limit("CHAT_RATE_LIMIT", "30/minute", "300/minute")

# Voice STT + TTS — most likely to throttle at a booth.
VOICE_LIMIT = _limit("VOICE_RATE_LIMIT", "10/minute", "120/minute")

# Document verify-token / upload / rename.
DOC_LIMIT = _limit("DOC_RATE_LIMIT", "10/minute", "120/minute")

# Signed PDF-URL fetch (called when opening the PDF panel).
PDF_URL_LIMIT = _limit("PDF_URL_RATE_LIMIT", "20/minute", "240/minute")

# Seed featured documents (admin/setup action).
SEED_LIMIT = _limit("SEED_RATE_LIMIT", "5/minute", "30/minute")
