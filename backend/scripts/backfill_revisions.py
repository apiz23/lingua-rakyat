"""Backfill missing revision records for historical documents.

Dry-run by default:

    python -m scripts.backfill_revisions
    python -m scripts.backfill_revisions --apply --limit 20

Backfilled revisions are private/pending and never approved or published.
"""

from __future__ import annotations

import argparse
import json
import sys

from utils.auth import get_supabase
from utils.ingestion.backfill import run_backfill


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill document revision records")
    parser.add_argument("--apply", action="store_true", help="Write revisions (default: dry-run)")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--after", default=None, help="Resume after this document id")
    parser.add_argument("--no-index", action="store_true", help="Create revisions without vector indexing")
    args = parser.parse_args()

    client = get_supabase(admin=True)
    summary = run_backfill(
        client,
        dry_run=not args.apply,
        limit=args.limit,
        after=args.after,
        index=not args.no_index,
        progress=lambda result: print(json.dumps(result.__dict__), flush=True),
    )
    print(json.dumps(summary.as_dict(), indent=2))
    return 0 if summary.failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
