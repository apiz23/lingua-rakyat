# Architecture reconstruction — 2026-11-03

Branch: `reconstruction/lingua-rakyat-architecture-2026-11-03` (created from
`master` at `25a2090`). The pre-existing uncommitted work on
`integration/architecture-consolidation` was carried into this branch
unchanged; nothing was committed, pushed or deployed.

## Recovered

- Commits `36e2ae1` (audience route groups) and `53a429f` (local development +
  Playwright smoke tests) were applied to the working tree.
- Dirty edits from the integration branch were preserved: `(public)/page.tsx`,
  `(admin)/manage/page.tsx`, `app/globals.css`, `backend/utils/auth.py`,
  `README.md`, `supabase/schema.sql`, the untracked architecture docs, SQL
  inventory and logo assets.

## Implemented in source

### Backend authorization

- `backend/utils/authorization.py`: one actor model (anonymous, citizen, admin,
  researcher, internal, machine), strict bearer parsing, ownership checks and
  permission checks. No trusted role provider is approved, so admin,
  researcher and internal calls fail closed with HTTP 503; authentication alone
  never grants a role.
- Malformed `Authorization` headers now return 401 instead of silently
  downgrading to anonymous (`backend/utils/auth.py`).
- Machine credentials compare a configured server-side secret in constant
  time.

### Frontend API transport

- `frontend/lib/http.ts` is the single transport: same-origin in the browser
  when `NEXT_PUBLIC_API_URL` is unset, absolute-URL requirement on the server,
  Clerk bearer injection, one safe 401 retry only with a different fresh token,
  no anonymous downgrade, no refresh on 403, typed 429, `no-store` defaults,
  no manual `Content-Type` for FormData, streams never consumed, cancellation
  honoured, no localhost fallback.
- `frontend/lib/api.ts` uses that transport for JSON, FormData and SSE calls.
- `frontend/components/navbar.tsx` scopes command-palette links by audience, so
  public/citizen surfaces do not advertise administration operations.

### Publication model and eligibility

- `supabase/migrations/2026-11-03-add-publication-registry.sql` (additive)
  adds `official_sources`, `document_revisions`, append-only
  `publication_events`, `answer_runs`, `current_revision`, and restrictive
  storage policies denying browser read/write on the private `documents`
  bucket. No Supabase-managed storage schema is altered.
- `backend/utils/publication_store.py`: trusted registry/revision reads,
  append-only events with idempotency keys, retry-safe expiry.
- `backend/utils/eligibility.py`: the one authoritative eligibility service.
  Public access requires an explicit public scope, published lifecycle, ready
  processing, a verified/usage-permitted/unrevoked/unexpired trusted source
  with a valid freshness window, and exactly one current approved revision with
  a storage path. Legacy docs now deny by default.
- `backend/routers/documents.py`: catalogue, status, PDF and signed-URL paths
  go through the service. Public catalogue responses no longer expose
  `storage_path`/`public_url`; they expose a backend `pdf_url`. Signed storage
  URLs now return 410; the PDF proxy always resolves the current revision's
  storage path.
- `backend/routers/share.py`: every cited revision is revalidated on read.
  A missing or ineligible citation suppresses the whole share (404).
- `backend/routers/chat.py`: every requested document must be publicly
  eligible or owned by the verified citizen before any provider work.
- `backend/utils/expiry.py` + `backend/scripts/expire_documents.py`: expiry is
  enforced at read time and swept server-side; each expiration event is
  recorded once and retries are no-ops. There is no unauthenticated endpoint.
- `backend/utils/idempotency.py`: authenticated `(actor, key)` answer runs.
  Same key + same body replays without provider work; changed body is 409;
  completion is committed before SSE `complete`; persistence failure emits one
  error and never `complete`.
- `backend/utils/rag_pipeline.py`: answer caching is disabled by default
  (`ENABLE_ANSWER_CACHE=false`) until revision-aware keys and cache-hit
  revalidation exist.

## Executed evidence

| Check | Result |
|---|---|
| Backend pytest (`python -m pytest tests -q`) | 449 passed |
| Frontend transport unit tests (`pnpm test:unit`) | 13 passed |
| TypeScript (`pnpm typecheck`) | passed |
| Production build (`pnpm build`) | passed; all audience routes present |
| ESLint on changed files | 0 errors (repo-wide lint has pre-existing errors) |
| Playwright smoke suite | **not executed** — local Next dev/start requests hang behind Clerk middleware in this environment (`socket hang up` / timeout); no assertion result is claimed |

## Deployment steps still required

1. Apply `2026-11-03-add-publication-registry.sql` with a reviewed,
   transactional migration run against a disposable PostgreSQL/Supabase
   project first. This checkout did **not** execute it against PostgreSQL.
2. Verify storage RLS behavior against real Supabase as `anon`, a signed-in
   user and the service role. Local SQL is not evidence of live policy.
3. Register trusted `official_sources` rows (issuer, authority, URL,
   verification status, usage rights, freshness window, verifier/time).
4. For each document: upload a revision row, then set the document to
   `visibility_scope=public`, `publication_status=published`, `source_id`,
   `approved_by/at`, `published_at`, `last_verified_at`, `current_revision`.
   No automation infers publication from `ready`, `featured`, agency or URL.
5. Run `python -m scripts.expire_documents` from a trusted scheduler if
   available; otherwise expiry is still enforced at read time.

## Remaining production blockers

- No approved server-side role/grant provider: admin, researcher and internal
  operations stay 503, and the admin/research routes mount no privileged API.
- Public catalogue is intentionally empty until a human approves sources and
  documents; legacy rows are hidden.
- Clerk `sub` is not Supabase `auth.uid()`; ownership stays in backend checks.
- Previously issued signed Storage URLs may remain valid until expiry; this
  change does not revoke them.
- Migration and storage-policy behavior are unverified against real
  PostgreSQL/Supabase.
- Mobile still has no idempotency-key plumbing; its 401 retry is pre-stream and
  credential-only, with no anonymous downgrade.
- Anonymous Q&A is still not persisted; account merge remains disabled.
