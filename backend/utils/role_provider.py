"""Trusted, server-side admin role and permission provider.

Roles live in ``public.admin_roles`` and are granted/revoked only by the
backend (service role) after a super-admin permission check. The browser never
supplies a role. A missing table or read failure is treated as "provider
unavailable" and callers fail closed with HTTP 503.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Iterable, Optional

logger = logging.getLogger("role_provider")

ROLES_TABLE = os.getenv("ADMIN_ROLES_TABLE", "admin_roles")

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "super_admin": frozenset(
        {
            "admin.dashboard.read",
            "admin.documents.read",
            "admin.documents.write",
            "admin.sources.read",
            "admin.sources.write",
            "admin.sources.verify",
            "admin.review",
            "admin.publish",
            "admin.audit.read",
            "admin.roles.read",
            "admin.roles.manage",
            "admin.status.read",
            "admin.ingestion.read",
            "admin.ingestion.write",
        }
    ),
    "document_manager": frozenset(
        {
            "admin.dashboard.read",
            "admin.documents.read",
            "admin.documents.write",
            "admin.sources.read",
            "admin.status.read",
            "admin.ingestion.read",
            "admin.ingestion.write",
        }
    ),
    "reviewer": frozenset(
        {
            "admin.dashboard.read",
            "admin.documents.read",
            "admin.sources.read",
            "admin.review",
            "admin.status.read",
            "admin.ingestion.read",
        }
    ),
    "publisher": frozenset(
        {
            "admin.dashboard.read",
            "admin.documents.read",
            "admin.sources.read",
            "admin.publish",
            "admin.status.read",
            "admin.ingestion.read",
        }
    ),
    "auditor": frozenset(
        {
            "admin.dashboard.read",
            "admin.documents.read",
            "admin.audit.read",
            "admin.status.read",
            "admin.ingestion.read",
        }
    ),
}

KNOWN_ROLES = tuple(ROLE_PERMISSIONS)


class RoleProviderUnavailable(RuntimeError):
    """Trusted role storage cannot be read."""


def _rows(client: Any) -> list[dict[str, Any]]:
    last_error: Optional[Exception] = None
    for attempt in range(2):
        try:
            result = client.table(ROLES_TABLE).select("*").execute()
            return [
                row for row in (getattr(result, "data", None) or []) if isinstance(row, dict)
            ]
        except Exception as exc:
            last_error = exc
            text = str(exc)
            if "42P01" in text or "PGRST205" in text:
                break
            if attempt == 0:
                continue
    text = str(last_error) if last_error else ""
    if "42P01" in text or "PGRST205" in text:
        logger.error(
            "[Roles] Table %s is missing. Admin operations stay unavailable "
            "until the admin migration is applied.",
            ROLES_TABLE,
        )
    raise RoleProviderUnavailable("Trusted role store unavailable") from last_error


def active_roles(actor_id: str, client: Any) -> set[str]:
    if not actor_id:
        return set()
    roles: set[str] = set()
    for row in _rows(client):
        if row.get("actor_id") != actor_id:
            continue
        if row.get("revoked_at"):
            continue
        role = row.get("role")
        if isinstance(role, str) and role in ROLE_PERMISSIONS:
            roles.add(role)
    return roles


def permissions_for_roles(roles: Iterable[str]) -> frozenset[str]:
    permissions: set[str] = set()
    for role in roles:
        permissions.update(ROLE_PERMISSIONS.get(role, frozenset()))
    return frozenset(permissions)


def resolve_actor_permissions(actor_id: str, client: Optional[Any] = None) -> frozenset[str]:
    if client is None:
        from utils.auth import get_supabase

        client = get_supabase(admin=True)
    return permissions_for_roles(active_roles(actor_id, client))


def list_role_assignments(client: Any) -> list[dict[str, Any]]:
    return _rows(client)
