# OPS-01 ? operational readiness and reliability

## Scope and evidence

Local source review and deterministic mocked tests only. No remote Supabase, Pinecone, embedding provider, source fetch, deployment or production verification performed. Existing configured remote environment is NOT assumed disposable. Branch reconstruction/lingua-rakyat-architecture-2026-11-03; HEAD 86af77cd13b34e817547925f72284558c19198df unchanged. Existing dirty frontend/backend/database work preserved. Architecture baseline: docs/ARCHITECTURE.md and docs/SECURITY.md; current implementation source takes precedence over older proposal statements.

## Architecture

FastAPI modular monolith serves API operations; a separate synchronous worker process polls database-backed ingestion_jobs. Supabase provides PostgreSQL and private object storage, Pinecone stores revision-specific derived vectors, Cohere embeds chunks. Official-source connectors perform bounded HTTP requests; pypdf extracts text. Review/promotion use existing trusted actor permissions and SQL lifecycle RPCs. No Redis/Celery/Kafka requirement established.

## Worker lifecycle and audited behavior

1. claim_next_job recovers expired leases then reads due queued jobs and conditionally updates status=queued to running. That status compare prevents two claimants from successfully claiming the same row. Attempts increment and worker ID, heartbeat and lease are persisted.
2. Default lease: 1800 seconds. Progress updates renew lease at STAGE boundaries; this is not a periodic heartbeat thread. Long synchronous extraction/provider calls may exceed it.
3. Ownership filters on job progress/completion/failure prevent an old worker from finishing a replacement worker's job. These filters do not fence all external side effects or document/candidate writes: stale execution requires further hardening before distributed production claims.
4. Lease recovery now compares the exact observed lease as well as status/owner. A heartbeat renewal after the read cannot be overwritten. Recovered count reflects rows actually changed. Legacy rows lacking leases use started_at comparison; legacy transition races are not proven safe with current adapter.
5. Failed jobs are not automatically requeued. Authorized explicit retry applies bounded exponential delay in minutes (min(2**attempts,60)), clears lease and uses max_attempts default 3. Retry now conditionally compares failed status and observed attempts, refusing concurrent state changes.
6. Cancellation follows existing contract: queued jobs can cancel; running cancellation is cooperative at checks, not process interruption. Never promise immediate abort during provider I/O.
7. SIGINT/SIGTERM stop the claim loop after current synchronous execution. Idle wait now wakes immediately via threading.Event. Active work is NOT force-cancelled; forced termination leaves the job until lease recovery. Poll interval must be finite and greater than zero; invalid values fail before creating clients.
8. Active candidate unique index provides duplicate-candidate job protection when migration is present. Discovery duplicate prevention is read-before-insert without an equivalent discovery uniqueness guarantee; duplicate concurrent discovery remains a limitation. No database schema changed.

## Concrete fixes

- Heartbeat/recovery TOCTOU: recovery could fail a still-running renewed lease. Added observed lease predicate and truthful recovery count.
- Retry/claim TOCTOU: retry could overwrite an already-running replacement job. Added status/attempt comparison and conflict response.
- Embedding cardinality: zip silently accepted fewer embeddings than chunks, creating a smaller apparently successful revision. Now count and nonempty vectors validate before obtaining/mutating index.
- Unknown or extra namespace vectors: indexing previously accepted missing count and surplus vectors. It now requires exact observed vector count; eventual-consistency lag fails closed rather than marking indexed.
- Index fetch AttributeError previously downgraded verification to count-only. It now fails closed. Existing promotion verification and SQL preconditions remain unchanged.
- Invalid poll interval caused crashes/spins; validate finite positive values.
- Idle shutdown delayed until sleep ended; event-based wait is interruptible.
- Worker boundary logs are JSON records with timestamp, event, worker_id, job_id/attempt/error_type as applicable. No exception messages, secrets or document text are emitted by these new records.

## Revision indexing and recovery

Namespace format doc:<document_id>:rev:<revision> isolates revisions. Deterministic chunk IDs include revision/index/content hash. Pending revision indexing must never target current published namespace. Existing service refuses reprocessing published documents in place; promotion requires approved/indexed revision and verified source/rights/expiry plus vector checks. SQL RPC updates current revision/events/audit atomically with expected-current validation; fallback to non-atomic mutation is absent. Retrieval resolves current authoritative revision; existing tests cover isolation and promotion failures.

Failure procedure: leave failed/pending revision unpublished; inspect failure classification, source verification, storage presence, exact namespace count and sample metadata using approved test/operator tools. Retry only the failed pending revision after ownership/lease checks. Never set indexing_status= indexed manually or bypass verification. Do not delete current namespace. Partial upserts can leave vectors in pending namespace; a retry attempts namespace replacement. Namespace delete errors are currently swallowed, but exact count/sample checks now catch many stale leftovers; full-vector reconciliation is not proven. Samples do not prove every vector's metadata. Promotion verify_revision_index still uses minimum count plus samples: exact full-manifest verification remains recommended.

## Environment and startup safety

Required for worker database access: SUPABASE_URL and SUPABASE_KEY (service-role, secret). Required for public catalogue readiness: SUPABASE_ANON_KEY. Storage bucket/table names must match the disposable instance schema. Embedding: COHERE_API_KEY; optional COHERE_EMBED_MODEL defaults embed-multilingual-v3.0. Index: PINECONE_API_KEY and explicit PINECONE_INDEX strongly recommended; existing default docuquery is not environment isolation. INGESTION_WORKER_ID optional; default includes host plus random process suffix.

Official-source knobs: INGESTION_MAX_DISCOVERY_BYTES default 2 MiB; INGESTION_MAX_DOCUMENT_BYTES 20 MiB; INGESTION_CONNECT_TIMEOUT 10s; INGESTION_READ_TIMEOUT 30s; INGESTION_MIN_INTERVAL_SECONDS 1.5. Numeric environment knobs are parsed at import, not comprehensively validated. Source allowlists and verified rights/freshness must exist before discovery. For API identity, use existing CLERK_ISSUER and trusted role provider configuration; do not infer admin authority from sign-in or a service key. No authentication changes in this phase.

Configuration is validated lazily by service/client initialization; there is no comprehensive startup environment preflight or enforced production/development split. Worker does not itself load dotenv; supply process environment explicitly. main.py loads dotenv for API startup. Never run local worker against repository backend/.env until its endpoints are explicitly verified disposable. Never print configuration values, dump environment, paste service keys, or infer non-production from Clerk development keys.

## Local procedures

Commands below are instructions, not proof a remote worker run was performed. Start only after selecting an empty/disposable LOCAL Supabase/storage setup with existing migrations applied there by an authorized operator. No production migrations are authorized.

From canonical backend directory:

    .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
    .\.venv\Scripts\python.exe -m scripts.ingestion_worker --once
    .\.venv\Scripts\python.exe -m scripts.ingestion_worker --interval 5

--once returns 0 after executing a claimed job and 1 if no job was available; it is NOT a publication-success or job-success exit code. Read persisted job state. Ctrl+C requests graceful shutdown; in-progress synchronous calls must finish or hit their adapter timeout. Avoid forced kill; after a crash, inspect expired running jobs and retry through authorized ingestion API only after recovery marks failure.

Deterministic offline regression command:

    $env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
    .\.venv\Scripts\python.exe -m pytest tests -q

No worker CLI was invoked against configured infrastructure during OPS-01; only test mocks exercised worker behavior.

## External service resilience

| Dependency | Existing protection | Remaining limit |
|---|---|---|
| Official HTTP sources | Connect/read timeouts, redirect host and address validation, byte caps, robots and minimum interval | No global multi-worker rate budget; DNS/robots/provider edge cases need disposable integration tests |
| PDF extraction | PDF validation, page limit 500, quality/OCR classification and bounded download bytes | CPU/memory/time of pathological PDFs not sandboxed; page limit alone does not bound parser cost |
| Cohere embeddings | Explicit 30s request timeout; absent key/empty response fails | No centralized retry-after/backoff/circuit breaker; now cardinality failures fail closed |
| Pinecone | Revision namespaces, deterministic IDs, count/sample verification | SDK-default timeout/retry budget not explicitly centralized; no atomic cross-store transaction; consistency lag can cause safe false failures |
| Supabase | Lazy client config checks, fail-closed anon config, database job lease compares | SDK default timeout/retry; row scans and no external-side-effect fencing; remote policy not verified |

Do not add blind retries around mutations, promotion, revision insertion or audit writes. Use bounded jittered retries only for classified idempotent operations and record exhaustion. Circuit breakers need measured outage/latency evidence before implementation; none added here.

## Health, observability and operator diagnostics

/health/live is process liveness, not worker availability. /health/ready attempts anon catalogue access and has an existing service-role diagnostic fallback; readiness success does not prove anon/RLS/storage readiness. Its checks include key shape/error type but not secret values. Existing raw provider exception logging may contain infrastructure paths/URLs and needs a separate redaction pass; new worker events deliberately emit only error types. No public health contract changed.

There is no dedicated worker health registry/continuous heartbeat metric; infer recent activity from persisted heartbeat/lease plus process supervision. Recommended private operator metrics: queued age, running count, expired leases, lease recovery count, job latency by stage, attempts/exhaustion by class, cancellation latency, indexing expected/observed vectors, provider timeout/rate-limit counts, database latency/error rate, and timestamp of last successful claim/progress. Never include credentials, raw PDF text or full storage URLs as metric labels. Monitor via internal authorized tooling, not anonymous health endpoints.

Recovery runbook: identify job ID and structured event; inspect persisted status/worker/lease/attempt budget; distinguish source validation/permanent failures from transient provider errors; repair configuration/rights outside job execution; retry only after failed state and within budget; verify revision remains pending and current_revision unchanged. Escalate retry exhaustion rather than resetting attempts manually. For provider outage, stop new claims gracefully and let bounded calls finish. For database outage, supervise worker process and retain logs; do not treat inability to inspect cancellation as proof cancellation is false.

## Deterministic tests and evidence limits

New tests cover renewed-lease race, retry/claim race, empty/short/extra embeddings, empty vectors, unknown/short/surplus namespace count, embedding timeout before index mutation, invalid intervals before client creation, and shutdown wait interruption. Existing ingestion/revision/backfill/authorization tests retain coverage for status claim, stale recovery, backoff, retry exhaustion, cancellation, old-owner completion refusal, source safety and promotion preservation.

Focused initial run: 72 passed, 7 warnings. First full run with 14 new cases: 577 passed, 9 warnings. Final run includes additional retry-race test; see final result below. Warnings are dependency deprecations. Test collection import/path errors during setup were corrected before these passing runs; no assertions were weakened.

Mocked comparisons demonstrate interleavings, NOT a live PostgreSQL concurrent stress test. No live Supabase/RLS/storage/Pinecone/provider testing, SQL migration execution, publication or production mutation occurred.

## Remaining risks / closure

Not a production-readiness certification. Continuous heartbeat during long calls, external mutation fencing after lost lease, same-process global worker bindings, discovery duplicate uniqueness, legacy lease recovery, partial multi-store crash recovery, parser sandboxing, provider budget configuration, full-vector manifest checks, raw-exception redaction and comprehensive config preflight remain operational hardening work. Keep a single worker per process; use supervision and leases, not assumptions of exactly-once execution. Current unit mocks do not establish distributed exactly-once semantics. No new infrastructure or schema changes introduced.

## Exact OPS-01 changes

- backend/utils/ingestion/service.py ? lease/retry optimistic concurrency fixes.
- backend/utils/rag_pipeline.py ? embedding and index verification fail-closed checks.
- backend/scripts/ingestion_worker.py ? interval validation, interruptible idle wait, structured worker-boundary logs.
- backend/tests/test_ops_reliability.py ? deterministic reliability regressions.
- docs/operations/OPS-01-operational-readiness.md ? this runbook and evidence report.

All pre-existing dirty work is preserved. No frontend UI edits, authentication acquisition, commits, pushes, merges or deployments.

## Final validation snapshot

Full backend regression: **578 passed, 9 dependency-deprecation warnings, 28.38 seconds**, exit 0. New OPS-01 cases: **15**. Previous source suite baseline: 563 tests. Focused initial ingestion/revision run: 72 passed. Tracked changed-file whitespace check passed. Current branch and HEAD unchanged; 59 Git status entries versus 57 at start (new test file and docs/operations directory), with pre-existing files and all QA artifacts preserved. No staged changes introduced. No live-service or production evidence claimed.
