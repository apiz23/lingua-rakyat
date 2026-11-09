"""Run the document-expiry sweeper with the service-role client.

Usage:
    python -m scripts.expire_documents

This is a trusted, server-side operation (scheduler or operator shell). There
is deliberately no unauthenticated HTTP endpoint. Retries are safe: each
expiration is recorded at most once.
"""

from __future__ import annotations

import sys

from utils.auth import get_supabase
from utils.expiry import run_expiry


def main() -> int:
    try:
        summary = run_expiry(get_supabase(admin=True))
    except Exception as exc:  # report and fail the job; never pretend success
        print(f"expiry failed: {type(exc).__name__}", file=sys.stderr)
        return 1
    print(f"due={summary['due']} newly_expired={summary['expired']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
