# Security requirements and release gates

## Evidence limits and current status

This document consolidates security requirements and unresolved findings from local audits. It does not claim that production was inspected. **Implemented in source** is not the same as deployed or independently verified. The previous security plan records document admin mutations and evaluation handlers as fail-closed with HTTP 503, anonymous account merge as disabled, and admin/research grants as not approved. Verify these gates in the current source and deployment before release.

Status terms: **Implemented in source** = code path exists locally; **implemented, deployment unverified** = no live DB/storage/deployment evidence; **disabled** = deliberately unavailable/fails closed; **unresolved** = requires remediation or an explicit owner decision. An audit observation is not proof of exploitability.

## Identity and authorization

- Verify Clerk signature, issuer, token type and intended audience/authorized party; reject expired, malformed or wrong-context tokens. Define safe JWKS outage/rotation handling. A malformed Authorization header must not silently downgrade to anonymous.
- Authentication establishes identity only. Use verified subject as immutable actor context and enforce ownership in every service and endpoint. Never trust client owner IDs, anonymous browser IDs, route visibility, hidden controls or client metadata as authorization.
- Default deny on absent, stale, malformed or unavailable permission state. Login does not imply admin/researcher. Keep document administration and evaluation/internal operations disabled until trusted, revocable, distinct server-side grants, audited actions and denial tests are approved and deployed.
- Keep anonymous history merge disabled. Any future design requires a server-issued, random, expiring, single-use capability bound to the source session and verified destination, stored safely and consumed atomically; a client UUID is insufficient.
- Machine/webhook credentials have a separate principal and fixed scope; they must never impersonate citizens or admins.

## Ownership, history and shares

- `/me` data is scoped to verified subject for every read, update, delete, export and cache path. Test cross-account and account-switch behavior.
- History deletion and conversation operations must authorize ownership at the mutation boundary, not just at lookup or in the UI. Preserve auditability without logging prompts or secrets.
- Share creation uses the owner's persisted answer and sources, not client-supplied evidence. Public share reads revalidate source eligibility and revocation. Suppress the entire share if provenance is missing or any cited revision is ineligible unless a separately approved safe redaction policy exists. Revoke promptly and invalidate metadata/image caches.

## Documents, retrieval and source verification

- One server-owned eligibility predicate must protect catalogue, direct-ID lookup, PDF/status retrieval, vector search, post-retrieval citations, SSE output, shares and caches. Unknown/unclassified/private/expired/revoked/suspended sources deny by default. A ready document is not automatically public.
- Verify citation identity and provenance against actual retrieved records; do not mark an answer verified merely because it contains citations. Validate claim/source links, document and revision identity, page/chunk references, completeness and truncation. If verification is incomplete or a source is ineligible, abstain or suppress the affected answer/share.
- Treat PDFs, OCR, retrieved passages and user input as untrusted. Prompt instructions do not provide access control. Prevent prompt injection from changing scope, exposing private context, invoking tools or fabricating source evidence.
- Private PDFs stay in private storage. Prefer an authorization-checked proxy that rechecks eligibility on each request; signed URLs have a revocation window and require explicit risk acceptance. Test byte/range/download paths and direct bucket access. A prior security plan **reported** signed URLs lasting 3600 seconds; this is unverified, not production evidence. Confirm whether that signed-URL access path still exists before relying on this duration or assessing revocation risk.
- Offline and browser caches must be identity/session scoped, cleared on sign-out/account switch and revalidated for revocable content. Prior reports flagged global cache keys; confirm whether fixed before claiming this requirement is met.

## Supabase, RLS and storage

- Inventory actual deployed grants, RLS policies, functions, sequences and storage bucket/object policies. Repository SQL does not prove live posture.
- Use least-privilege DB roles, default-deny RLS, private buckets and explicit owner/public eligibility policies. Never expose service-role credentials to clients. Any server-side RLS bypass must repeat equivalent authorization and audit checks in trusted services.
- Test direct SQL and object access as anon, authenticated users with distinct subjects, least-privilege service roles and service-role paths. Verify cross-owner isolation, no public private-object access and safe migration rollback.
- Do not backfill publication status by inferring from readiness or existing presence. Require reviewed source/owner/approval inventory; unclassified rows remain private/draft.

## Abuse, privacy and operations

- Bound request bytes before buffering, including voice/audio uploads; validate media type, duration and text lengths. Apply per-actor/IP plus global concurrency/spend budgets, timeouts and provider limits to voice, chat, feedback and ingestion.
- Trust forwarded IP headers only from configured proxies and parse the trusted chain correctly. Current rate-limit source reads forwarded headers without validating proxy origin; this is an unresolved spoofing risk until ingress topology and trusted proxies are configured and tested.
- Minimize telemetry: do not log credentials, signed URLs, raw prompts, audio, private snippets or sensitive provider output. Define retention, deletion, consent and access before research use. Default to no raw citizen prompt retention absent explicit approval.
- Keep public health responses minimal. Restrict or disable OpenAPI/docs in production if they disclose internal routes or details. Validate security headers, CORS, CSRF protections where cookie auth is used, and secret redaction.
- Audit privileged attempts and outcomes with verified actor, permission, operation, object/version, result and correlation ID in protected append-only storage; exclude secrets and content.

### Rate limits and booth mode

`backend/rate_limits.py` in this checkout sets `BOOTH_MODE=false` by default. For a controlled demo, set `BOOTH_MODE=true` in the backend environment and restart/redeploy the backend afterward; restore `false` when the event ends. Booth mode changes rate budgets, not authorization.

| Budget | Normal | Booth mode |
|---|---:|---:|
| Global default | 200/minute | 2000/minute |
| Chat | 30/minute | 300/minute |
| Voice | 10/minute | 120/minute |
| Documents | 10/minute | 120/minute |
| PDF URL | 20/minute | 240/minute |
| Seed operation | 5/minute | 30/minute |

Overrides take precedence over either mode: `GLOBAL_RATE_LIMIT`, `CHAT_RATE_LIMIT`, `VOICE_RATE_LIMIT`, `DOC_RATE_LIMIT`, `PDF_URL_RATE_LIMIT`, and `SEED_RATE_LIMIT`, using SlowAPI limit syntax. These are current source values, not a statement of deployed settings. The source selects the first `X-Forwarded-For` entry, then `X-Real-IP`, then the direct peer, without validating the forwarding proxy. Do not rely on IP-based limits until ingress trusts only configured proxies and forwarded-chain behavior is verified; this remains an unresolved control.

## Unresolved findings and decisions

The prior security/architecture audits identified the following; the items are **not declared fixed** by consolidation:

1. **Publication policy integration:** the publication helper was reported as unused by runtime catalogue/PDF/retrieval paths. Confirm current call sites and enforce one eligibility policy end to end.
2. **Database and storage posture:** deployed Supabase grants, RLS and bucket access were not inspected. Complete live inventory and role-based negative tests before public rollout.
3. **Admin/research authority:** no approved trusted grant source was recorded; document mutations and evaluation are intentionally unavailable in local source pending authorization design.
4. **Proxy trust and rate limits:** forwarded headers were trusted without origin validation; voice request size was checked after reading content into memory; feedback lacked a dedicated limiter in the audited source. Verify current implementation and ingress controls.
5. **Identity token context:** prior review noted disabled audience verification and the need to define token context and malformed-header behavior. Verify and resolve explicitly.
6. **Offline cache isolation:** prior review found global browser cache keys. Verify identity partitioning and purge behavior across sign-out/account switch.
7. **PDF/share revocation:** one-hour signed URL behavior was reported; determine whether any path remains and document accepted revocation lag. Share and OG caches must not outlive eligibility.
8. **Anonymous merge:** deliberately disabled; do not re-enable without capability-based transfer and replay/race tests.
9. **Evaluation retention and public results:** retention, consent and reviewed aggregate publication need owner decisions. No internal raw metrics should become public by default.
10. **AI source verification:** preserve citation/claim linkage, source-version checks, completeness/truncation detection and fail-closed behavior. Run backend and mobile integration tests; the previous integration audit reported evidence-ID and premature-stream-completion concerns.

## Minimum release gates

Before enabling any affected public or privileged path:

1. Identify code, migration and deployment state separately; record evidence and owner for each claim.
2. Resolve the decisions above. Keep admin, research, merge and unclassified publication disabled while unresolved.
3. Test anonymous, ordinary citizen, owner, cross-owner, authorized role, wrong role, revoked role, malformed/expired token, policy outage and direct storage access. Denials must have no side effects.
4. Test web and mobile compatibility, SSE disconnect/abort/completion, share/OG cache invalidation, citation provenance and source revocation.
5. Rehearse additive migration, reviewed backfill, rollback and least-privilege verification. Never roll back to unrestricted access.
6. Monitor denial rates, budget and audit gaps without retaining sensitive content. Record residual risks and explicit acceptance; this document itself grants no exception.
