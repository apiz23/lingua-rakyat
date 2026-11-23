"""
Clerk JWT verification for optional sign-in.

Identity model: a request with a valid `Authorization: Bearer <token>` header
resolves to the Clerk user id (`sub` claim). A request with no header resolves
to None — callers fall back to the client-supplied anonymous user_id, which is
today's behavior. An invalid token is a hard 401, never a silent fallback.
"""

import logging
import os
import threading
import time
from typing import Optional

import httpx

import jwt
from fastapi import HTTPException, Request
from supabase import Client, create_client

logger = logging.getLogger("auth")

CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")

_jwk_client: Optional[jwt.PyJWKClient] = None

# The admin UI can issue several parallel requests per page load. Looking the
# account email up over HTTPS on every one of them adds latency and risks Clerk
# API rate limits, so verified emails are cached briefly per subject.
_EMAIL_CACHE_TTL_SECONDS = 300.0
_EMAIL_CACHE_MAX_ENTRIES = 500
_email_cache: dict[str, tuple[float, Optional[str]]] = {}
_email_cache_lock = threading.Lock()


def _cached_account_email(subject: str) -> tuple[bool, Optional[str]]:
    now = time.monotonic()
    with _email_cache_lock:
        entry = _email_cache.get(subject)
        if entry is None:
            return False, None
        cached_at, email = entry
        if now - cached_at > _EMAIL_CACHE_TTL_SECONDS:
            _email_cache.pop(subject, None)
            return False, None
        return True, email


def _cache_account_email(subject: str, email: Optional[str]) -> None:
    with _email_cache_lock:
        if len(_email_cache) >= _EMAIL_CACHE_MAX_ENTRIES:
            _email_cache.clear()
        _email_cache[subject] = (time.monotonic(), email)


def _authorized_parties() -> frozenset[str]:
    """Allowed Clerk ``azp`` origins, configured per deployment."""
    raw = os.getenv("CLERK_AUTHORIZED_PARTIES", "")
    return frozenset(
        party.strip().rstrip("/")
        for party in raw.split(",")
        if party.strip()
    )


def verified_account_email(subject: str) -> Optional[str]:
    """Resolve a verified primary email using the server's Clerk credential."""
    from urllib.parse import quote

    cached, email = _cached_account_email(subject)
    if cached:
        return email

    secret = _env_value("CLERK_SECRET_KEY")
    if not secret:
        raise RuntimeError("CLERK_SECRET_KEY is required for account email lookup")
    try:
        response = httpx.get(
            "https://api.clerk.com/v1/users/" + quote(subject, safe=""),
            headers={"Authorization": "Bearer " + secret},
            timeout=10,
        )
        response.raise_for_status()
        user = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise RuntimeError("Account email lookup unavailable") from exc
    primary_id = user.get("primary_email_address_id")
    for address in user.get("email_addresses", []):
        if address.get("id") == primary_id and (address.get("verification") or {}).get("status") == "verified":
            email = address.get("email_address")
            resolved = email.strip().lower() if isinstance(email, str) else None
            _cache_account_email(subject, resolved)
            return resolved
    _cache_account_email(subject, None)
    return None






_supabase: Optional[Client] = None
_supabase_admin: Optional[Client] = None


def _env_value(name: str) -> str:
    """Read an env var and remove copy/paste artefacts (spaces, quotes, CRLF)."""
    return (os.getenv(name) or "").strip().strip('"').strip("'")


def get_supabase(admin: bool = False) -> Client:
    """
    Return a Supabase client.
    admin=True  → service_role key (destructive/privileged ops).
    admin=False → anon key. Public reads fail closed without it; the service
    role key is never used as an implicit fallback here.
    """
    global _supabase, _supabase_admin

    if admin:
        if _supabase_admin is None:
            url = _env_value("SUPABASE_URL")
            key = _env_value("SUPABASE_KEY")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in your .env file.")
            _supabase_admin = create_client(url, key)
        return _supabase_admin

    if _supabase is None:
        url = _env_value("SUPABASE_URL")
        key = _env_value("SUPABASE_ANON_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set for public Supabase access.")
        _supabase = create_client(url, key)
    return _supabase


def _get_jwk_client() -> jwt.PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        if not CLERK_ISSUER:
            raise RuntimeError("CLERK_ISSUER must be set to verify sign-in tokens.")
        _jwk_client = jwt.PyJWKClient(
            f"{CLERK_ISSUER}/.well-known/jwks.json", cache_keys=True
        )
    return _jwk_client


def verify_clerk_claims(token: str) -> dict:
    """Return verified Clerk claims. Raises jwt exceptions when invalid."""
    signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=CLERK_ISSUER,
        # Clerk session tokens live 60s; allow clock skew between the
        # device that minted the request and this server (Clerk's own
        # SDKs tolerate the same drift).
        leeway=60,
        # Clerk session tokens carry `azp`, not `aud`.
        options={"verify_aud": False},
    )
    allowed_parties = _authorized_parties()
    if allowed_parties:
        authorized_party = claims.get("azp")
        if (
            not isinstance(authorized_party, str)
            or authorized_party.strip().rstrip("/") not in allowed_parties
        ):
            raise jwt.InvalidTokenError("Token was issued for an unauthorized party")
    sub = claims.get("sub", "")
    if not sub:
        raise jwt.InvalidTokenError("Token has no sub claim")
    return claims


def verify_clerk_token(token: str) -> str:
    """Return the Clerk user id (sub). Raises jwt exceptions when invalid."""
    return str(verify_clerk_claims(token)["sub"])


def parse_bearer_token(auth_header: Optional[str]) -> Optional[str]:
    """Return the bearer token, or None when no credential was supplied.

    A present but malformed Authorization header is an authentication failure,
    not an anonymous request: silently downgrading it would turn a broken
    authenticated call into a less-privileged one.
    """
    if auth_header is None:
        return None
    parts = auth_header.strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Malformed Authorization header")
    token = parts[1].strip()

    if any(char.isspace() for char in token):
        raise HTTPException(status_code=401, detail="Malformed Authorization header")
    return token


def get_verified_user(request: Request) -> Optional[str]:
    token = parse_bearer_token(request.headers.get("authorization"))
    if token is None:
        return None
    try:
        return verify_clerk_token(token)
    except jwt.exceptions.PyJWKClientConnectionError as exc:
        logger.error("[Auth] JWKS unreachable: %s", exc)
        raise HTTPException(status_code=503, detail="Sign-in verification unavailable") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
    except RuntimeError as exc:
        logger.error("[Auth] Misconfiguration: %s", exc)
        raise HTTPException(status_code=503, detail="Sign-in verification unavailable") from exc
