"""Idempotent answer runs for authenticated chat requests.

A run is identified by ``(actor, idempotency_key)``. Reusing the same key with
the same request body replays the committed result without repeating provider
work; reusing it with a different body is a conflict. Completion is recorded
before the client is told the run finished.

The store is authoritative Supabase storage behind the service role. Provider
or store outages raise :class:`IdempotencyUnavailable`; callers must fail the
request rather than silently repeating work.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Optional

logger = logging.getLogger("idempotency")

RunState = Literal["new", "replay", "in_progress", "conflict"]


class IdempotencyUnavailable(RuntimeError):
    """The idempotency store could not be read or written."""


def runs_table() -> str:
    return os.getenv("ANSWER_RUNS_TABLE", "answer_runs")


@dataclass(frozen=True)
class RunClaim:
    state: RunState
    response: Optional[dict[str, Any]] = None


def request_fingerprint(payload: dict[str, Any]) -> str:
    """Stable hash of the request content (excludes the idempotency key)."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _query(client: Any, actor_id: str, key: str):
    return (
        client.table(runs_table())
        .select("*")
        .eq("actor_id", actor_id)
        .eq("idempotency_key", key)
        .limit(1)
        .execute()
    )


def _existing(client: Any, actor_id: str, key: str) -> Optional[dict[str, Any]]:
    try:
        rows = getattr(_query(client, actor_id, key), "data", None) or []
    except Exception as exc:
        raise IdempotencyUnavailable("Could not read answer runs") from exc
    return rows[0] if rows and isinstance(rows[0], dict) else None


def claim_run(
    client: Any,
    *,
    actor_id: str,
    idempotency_key: str,
    fingerprint: str,
) -> RunClaim:
    if not actor_id or not idempotency_key:
        raise ValueError("actor_id and idempotency_key are required")

    existing = _existing(client, actor_id, idempotency_key)
    if existing is not None:
        if existing.get("request_fingerprint") != fingerprint:
            return RunClaim("conflict")
        status = existing.get("status")
        if status == "complete":
            response = existing.get("response")
            if isinstance(response, dict):
                return RunClaim("replay", response)
            return RunClaim("conflict")
        if status == "in_progress":
            return RunClaim("in_progress")

        if not _set_in_progress(client, actor_id, idempotency_key):
            raise IdempotencyUnavailable("Could not restart failed answer run")
        return RunClaim("new")

    payload = {
        "actor_id": actor_id,
        "idempotency_key": idempotency_key,
        "request_fingerprint": fingerprint,
        "status": "in_progress",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        client.table(runs_table()).insert(payload).execute()
    except Exception as exc:

        raced = _existing(client, actor_id, idempotency_key)
        if raced is None:
            raise IdempotencyUnavailable("Could not start answer run") from exc
        if raced.get("request_fingerprint") != fingerprint:
            return RunClaim("conflict")
        return RunClaim("in_progress")
    return RunClaim("new")


def _set_in_progress(client: Any, actor_id: str, key: str) -> bool:
    try:
        result = (
            client.table(runs_table())
            .update(
                {
                    "status": "in_progress",
                    "response": None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("actor_id", actor_id)
            .eq("idempotency_key", key)
            .execute()
        )
    except Exception as exc:
        raise IdempotencyUnavailable("Could not update answer run") from exc
    return bool(getattr(result, "data", None))


def complete_run(
    client: Any,
    *,
    actor_id: str,
    idempotency_key: str,
    response: dict[str, Any],
) -> bool:
    """Commit the final answer. False means the row was not updated."""
    try:
        result = (
            client.table(runs_table())
            .update(
                {
                    "status": "complete",
                    "response": response,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("actor_id", actor_id)
            .eq("idempotency_key", idempotency_key)
            .execute()
        )
    except Exception as exc:
        raise IdempotencyUnavailable("Could not complete answer run") from exc
    return bool(getattr(result, "data", None))


def fail_run(client: Any, *, actor_id: str, idempotency_key: str) -> None:
    """Mark a run failed so a same-key retry may start cleanly."""
    try:
        (
            client.table(runs_table())
            .update(
                {
                    "status": "failed",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("actor_id", actor_id)
            .eq("idempotency_key", idempotency_key)
            .execute()
        )
    except Exception as exc:
        raise IdempotencyUnavailable("Could not fail answer run") from exc
