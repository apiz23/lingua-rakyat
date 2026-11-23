"""Centralized, env-gated rate-limit values.

All endpoints key by client IP. At a demo booth, every visitor shares one public
IP, so the per-IP buckets fill quickly and judges hit HTTP 429 mid-demo. Set
BOOTH_MODE=true to switch to generous limits for the controlled demo, then false
again for normal public use.

Normal-mode values match the limits that were previously hard-coded on each
route, so behavior is unchanged unless BOOTH_MODE (or a per-limit override) is
set. Each value can be overridden directly with its own env var
(e.g. CHAT_RATE_LIMIT="500/minute"), which takes precedence over BOOTH_MODE.

When deployed behind a reverse proxy (Vercel, Render, Cloudflare, nginx), the
raw client IP is the proxy's IP, not the end user's. Forwarded headers are only
trusted when the direct peer is a configured trusted proxy
(``TRUSTED_PROXY_IPS``) or when ``TRUST_PROXY_HEADERS=true`` is set explicitly;
otherwise any caller could spoof its own rate-limit key.
"""

import ipaddress
import os

from fastapi import Request


def _trusted_proxy_networks() -> list:
    networks = []
    for entry in os.getenv("TRUSTED_PROXY_IPS", "").split(","):
        value = entry.strip()
        if not value:
            continue
        try:
            networks.append(ipaddress.ip_network(value, strict=False))
        except ValueError:
            continue
    return networks


def _is_trusted_proxy(peer: str) -> bool:
    if os.getenv("TRUST_PROXY_HEADERS", "false").strip().lower() == "true":
        return True
    try:
        address = ipaddress.ip_address(peer)
    except ValueError:
        return False
    return any(address in network for network in _trusted_proxy_networks())


def get_proxy_aware_remote_address(request: Request) -> str:
    """
    Resolve the original client IP without trusting unverified headers.

    Forwarded headers are consulted only when the immediate peer is a trusted
    proxy. The rightmost entry is used because it is the hop appended by the
    first trusted ingress proxy; leftmost entries are caller-controlled.
    """
    client = request.client
    peer = client.host if client is not None else "unknown"
    if not _is_trusted_proxy(peer):
        return peer

    forwarded = request.headers.get("x-forwarded-for", "").strip()
    if forwarded:
        candidates = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
        if candidates:
            return candidates[-1]

    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip

    return peer


BOOTH_MODE = os.getenv("BOOTH_MODE", "false").lower() == "true"


def _limit(env_key: str, normal: str, booth: str) -> str:
    override = os.getenv(env_key, "").strip()
    if override:
        return override
    return booth if BOOTH_MODE else normal



GLOBAL_DEFAULT = _limit("GLOBAL_RATE_LIMIT", "200/minute", "2000/minute")


CHAT_LIMIT = _limit("CHAT_RATE_LIMIT", "30/minute", "300/minute")


VOICE_LIMIT = _limit("VOICE_RATE_LIMIT", "10/minute", "120/minute")


DOC_LIMIT = _limit("DOC_RATE_LIMIT", "10/minute", "120/minute")


PDF_URL_LIMIT = _limit("PDF_URL_RATE_LIMIT", "20/minute", "240/minute")


FEEDBACK_LIMIT = _limit("FEEDBACK_RATE_LIMIT", "60/minute", "300/minute")
