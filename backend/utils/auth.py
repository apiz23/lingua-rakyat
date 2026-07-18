"""
Clerk JWT verification for optional sign-in.

Identity model: a request with a valid `Authorization: Bearer <token>` header
resolves to the Clerk user id (`sub` claim). A request with no header resolves
to None — callers fall back to the client-supplied anonymous user_id, which is
today's behavior. An invalid token is a hard 401, never a silent fallback.
"""

import logging
import os
from typing import Optional

import jwt
from fastapi import HTTPException, Request

logger = logging.getLogger("auth")

CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")

_jwk_client: Optional[jwt.PyJWKClient] = None


def _get_jwk_client() -> jwt.PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        if not CLERK_ISSUER:
            raise RuntimeError("CLERK_ISSUER must be set to verify sign-in tokens.")
        _jwk_client = jwt.PyJWKClient(
            f"{CLERK_ISSUER}/.well-known/jwks.json", cache_keys=True
        )
    return _jwk_client


def verify_clerk_token(token: str) -> str:
    """Return the Clerk user id (sub). Raises jwt exceptions when invalid."""
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
    sub = claims.get("sub", "")
    if not sub:
        raise jwt.InvalidTokenError("Token has no sub claim")
    return sub


def get_verified_user(request: Request) -> Optional[str]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:].strip()
    if not token:
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
