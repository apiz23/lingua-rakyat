"""Database-backed ingestion worker.

Run separately from the API process:

    python -m scripts.ingestion_worker --once
    python -m scripts.ingestion_worker --interval 5

Jobs are claimed atomically via a conditional status update and carry a lease
and heartbeat. Expired leases are recovered by the service. No Redis/Celery.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
import os
import math
import threading
import signal
import socket
import sys
import uuid

from utils.auth import get_supabase
from utils.ingestion import service

_running = True
_shutdown = threading.Event()


def _stop(_signum, _frame):
    global _running
    _running = False
    _shutdown.set()


def _emit(event: str, **fields) -> None:
    print(json.dumps({"timestamp": datetime.now(timezone.utc).isoformat(), "event": event, **fields}), file=sys.stderr, flush=True)


def worker_id() -> str:
    return os.getenv("INGESTION_WORKER_ID") or f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"


def run_once(client, identity: str) -> bool:
    job = service.claim_next_job(client, identity)
    if not job:
        return False
    _emit("job_claimed", job_id=job["id"], worker_id=identity, attempt=job.get("attempts"))
    try:
        if job.get("job_type") == "discovery":
            service.run_discovery(client, job["id"], claimed=True)
        else:
            service.run_ingest(client, job["id"], claimed=True)
    except Exception as exc:

        _emit("job_execution_error", job_id=job["id"], worker_id=identity, error_type=type(exc).__name__)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Lingua Rakyat ingestion worker")
    parser.add_argument("--once", action="store_true", help="Claim and run at most one job")
    parser.add_argument("--interval", type=float, default=5.0, help="Idle poll interval seconds")
    args = parser.parse_args()

    if not math.isfinite(args.interval) or args.interval <= 0:
        parser.error("--interval must be a finite number greater than zero")

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    client = get_supabase(admin=True)
    identity = worker_id()
    _emit("worker_started", worker_id=identity)
    if args.once:
        return 0 if run_once(client, identity) else 1

    while _running:
        try:
            worked = run_once(client, identity)
        except Exception as exc:
            _emit("worker_loop_error", worker_id=identity, error_type=type(exc).__name__)
            worked = False
        if not worked:
            _shutdown.wait(args.interval)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
