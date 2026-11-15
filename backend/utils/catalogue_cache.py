"""Short-lived in-process cache for the public document catalogue.

The public catalogue is read on every workspace load and requires the document
rows plus the publication snapshot (sources and revisions). Caching the final
public shape for a few seconds removes repeated full-table reads while staying
well inside the governance window: approval, publication and lifecycle actions
invalidate the cache explicitly.
"""

from __future__ import annotations

import os
import threading
import time
from typing import Any, Optional

_DEFAULT_TTL_SECONDS = 15.0
_lock = threading.Lock()
_documents: Optional[list[dict[str, Any]]] = None
_documents_at: float = 0.0


def _ttl_seconds() -> float:
    raw = (os.getenv("DOCUMENT_CACHE_TTL_SECONDS") or "").strip()
    if not raw:
        return _DEFAULT_TTL_SECONDS
    try:
        value = float(raw)
    except ValueError:
        return _DEFAULT_TTL_SECONDS
    return value if value > 0 else 0.0


def get_documents() -> Optional[list[dict[str, Any]]]:
    ttl = _ttl_seconds()
    if ttl <= 0:
        return None
    with _lock:
        if _documents is None:
            return None
        if time.monotonic() - _documents_at > ttl:
            return None
        return [dict(row) for row in _documents]


def set_documents(rows: list[dict[str, Any]]) -> None:
    global _documents, _documents_at
    if _ttl_seconds() <= 0:
        return
    with _lock:
        _documents = [dict(row) for row in rows]
        _documents_at = time.monotonic()


def invalidate_documents() -> None:
    global _documents, _documents_at
    with _lock:
        _documents = None
        _documents_at = 0.0
