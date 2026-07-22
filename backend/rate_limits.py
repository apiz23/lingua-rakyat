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

When deployed behind a reverse proxy (Vercel, Render, Cloudflare, nginx), the
raw client IP is the proxy's IP, not the end user's. This module provides
get_proxy_aware_remote_address() which checks X-Forwarded-For and X-Real-IP
before falling back to the direct connection IP, so rate limits are enforced
on real users, not on proxy IPs.
"""

import os
from typing import Optional

from fastapi import Request


def get_proxy_aware_remote_address(request: Request) -> str:
    """
    Resolve the original client IP from proxy-forwarded headers.

    Priority:
      1. X-Forwarded-For (first, most trusted IP in the chain)
      2. X-Real-IP (single IP header, set by some proxies like nginx)
      3. request.client.host (direct connection — fallback)
    """
    forwarded = request.headers.get("x-forwarded-for", "").strip()
    if forwarded:
        candidates = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
        if candidates:
            return candidates[0]

    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip

    client = request.client
    if client is not None:
        return client.host

    return "unknown"


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
