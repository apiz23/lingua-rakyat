"""Centralized, fail-closed authorization boundaries.

Every privileged decision funnels through this module:

* :func:`get_actor` parses the request and verifies the Clerk session token.
* :func:`require_citizen` / :func:`require_owner` enforce citizen identity and
  ownership using the verified Clerk subject (never a client-supplied id).
* :func:`require_permission` requires a server-side grant. No trusted grant
  provider is approved for this deployment, so every permission check fails
  closed with HTTP 503 until one is installed.
* :func:`require_machine_credential` protects machine/server integrations with
  a server-side secret compared in constant time.

Route groups, hidden navigation, authentication alone and client metadata are
not authorization controls. Missing, malformed or unavailable identity and
permission state always denies.
"""

from __future__ import annotations

import hmac
import logging
import os
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Optional

import jwt
from fastapi import Depends, HTTPException, Request

from utils.auth import parse_bearer_token, verify_clerk_token

logger = logging.getLogger("authorization")


class ActorKind(str, Enum):
    ANONYMOUS = "anonymous"
    CITIZEN = "citizen"
    ADMIN = "admin"
    RESEARCHER = "researcher"
    INTERNAL = "internal"
    MACHINE = "machine"


@dataclass(frozen=True)
class Actor:
    """Verified request principal. ``subject`` is the Clerk ``sub`` claim."""

    kind: ActorKind
    subject: Optional[str] = None
    email: Optional[str] = None

    @property
    def is_authenticated(self) -> bool:
        return self.kind is not ActorKind.ANONYMOUS

    def require_subject(self) -> str:
        if self.kind is not ActorKind.CITIZEN or not self.subject:
            raise HTTPException(status_code=401, detail="Sign-in required")
        return self.subject


ANONYMOUS = Actor(ActorKind.ANONYMOUS)


class RoleSourceUnavailable(RuntimeError):
    """No trusted server-side permission source is available."""


# Permissions are explicit operation names, never inferred from login state.
DOCUMENTS_MANAGE = "documents.manage"
DOCUMENTS_PUBLISH = "documents.publish"
EVALUATION_READ = "evaluation.read"
EVALUATION_RECORD = "evaluation.record"
EXPIRY_RUN = "expiry.run"
INTERNAL_READ = "internal.read"


def resolve_permissions(actor: Actor) -> frozenset[str]:
    """Resolve the actor's server-side grants.

    Grants live in the trusted ``lr_admin_roles`` table and are read with the
    service role. No role is inferred from sign-in, request data or client
    metadata. A missing role table or unreadable store raises
    :class:`RoleSourceUnavailable` so callers fail closed with HTTP 503.
    """
    if not actor.is_authenticated or not actor.subject:
        return frozenset()

    from utils.role_provider import RoleProviderUnavailable, resolve_actor_permissions

    try:
        # Role records are keyed by the normalized email claim in the
        # verified session token and resolved only from Supabase.
        if not actor.email:
            return frozenset()
        return resolve_actor_permissions(actor.email.strip().lower())
    except RoleProviderUnavailable as exc:
        raise RoleSourceUnavailable("No trusted role provider is available") from exc
    except Exception as exc:  # configuration/connection errors must deny
        logger.error("[Authz] Role resolution failed: %s", type(exc).__name__)
        raise RoleSourceUnavailable("No trusted role provider is available") from exc


def get_actor(request: Request) -> Actor:
    """Resolve the request principal. Missing header = anonymous."""
    try:
        token = parse_bearer_token(request.headers.get("authorization"))
    except HTTPException:
        raise
    if token is None:
        return ANONYMOUS
    subject = None
    for attempt in range(2):
        try:
            from utils.auth import verify_clerk_claims

            claims = verify_clerk_claims(token)
            subject = claims.get("sub")
            email = claims.get("email")
            if os.getenv("CLERK_SECRET_KEY") or not isinstance(email, str) or not email.strip():
                from utils.auth import verified_account_email

                email = verified_account_email(subject)
            break
        except jwt.exceptions.PyJWKClientConnectionError as exc:
            if attempt == 0:
                logger.warning("[Auth] JWKS fetch failed, retrying once: %s", type(exc).__name__)
                continue
            logger.error("[Auth] JWKS unreachable: %s", exc)
            raise HTTPException(
                status_code=503, detail="Sign-in verification unavailable"
            ) from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
        except RuntimeError as exc:
            logger.error("[Auth] Misconfiguration: %s", exc)
            raise HTTPException(
                status_code=503, detail="Sign-in verification unavailable"
            ) from exc
    if not subject or not subject.strip():
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return Actor(ActorKind.CITIZEN, subject.strip(), email.strip().lower() if isinstance(email, str) and email.strip() else None)


def require_authenticated(actor: Actor = Depends(get_actor)) -> Actor:
    """Require a verified citizen identity."""
    if not actor.is_authenticated:
        raise HTTPException(status_code=401, detail="Sign-in required")
    return actor


# Alias kept for readability at call sites that only care about citizens.
require_citizen = require_authenticated


def authorize_owner(actor: Actor, owner_id: Optional[str], *, resource: str = "resource") -> str:
    """Return the verified subject if it owns ``owner_id``; otherwise deny."""
    subject = actor.require_subject()
    if not isinstance(owner_id, str) or not owner_id.strip():
        raise HTTPException(status_code=403, detail=f"Not authorized for this {resource}")
    if not hmac.compare_digest(subject, owner_id.strip()):
        raise HTTPException(status_code=403, detail=f"Not authorized for this {resource}")
    return subject


def require_owner(
    owner_id: Optional[str], *, resource: str = "resource"
) -> Callable[[Actor], Actor]:
    """Dependency factory binding a handler to an owned resource id."""

    def _dependency(actor: Actor = Depends(get_actor)) -> Actor:
        authorize_owner(actor, owner_id, resource=resource)
        return actor

    return _dependency


def require_permission(permission: str) -> Callable[[Actor], Actor]:
    """Require a server-side permission grant; fail closed when unavailable."""
    if not permission or not permission.strip():
        raise ValueError("permission must be a non-empty operation name")

    def _dependency(actor: Actor = Depends(get_actor)) -> Actor:
        if not actor.is_authenticated:
            raise HTTPException(status_code=401, detail="Sign-in required")
        try:
            grants = resolve_permissions(actor)
        except RoleSourceUnavailable as exc:
            logger.error("[Authz] Permission source unavailable for %s: %s", permission, exc)
            raise HTTPException(
                status_code=503,
                detail="This operation is temporarily unavailable.",
            ) from exc
        if permission not in grants:
            raise HTTPException(status_code=403, detail="Insufficient permission")
        return actor

    return _dependency


def require_machine_credential(provided: Optional[str], expected_env: str) -> None:
    """Validate a server-side machine credential in constant time."""
    expected = (os.getenv(expected_env) or "").strip()
    if not expected:
        logger.error("[Authz] Machine credential %s is not configured", expected_env)
        raise HTTPException(status_code=503, detail="Machine access is not configured")
    candidate = (provided or "").strip()
    if not candidate or not hmac.compare_digest(candidate, expected):
        raise HTTPException(status_code=401, detail="Invalid machine credential")
