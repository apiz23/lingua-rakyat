# Architecture and compatibility constraints

## Status and evidence

This is a concise record of constraints and proposed decisions consolidated from the architecture working papers. The earlier architecture package explicitly says its target baseline and decision register are **proposals, not approvals**. Nothing here authorizes enabling a privileged capability or publishing a document. Implementation statements below describe the local source reviewed for this cleanup; they do not establish production configuration or behavior. Recheck before rollout.

Status labels: **Implemented in source** means visible in this checkout; **implemented, deployment unverified** means local code exists but live enforcement was not checked; **disabled** means the local route deliberately denies or is not mounted; **proposed / future decision** means no approval was recorded in the source papers.

## System shape

The repository contains a Next.js web client, an Expo mobile client, and a FastAPI modular monolith. PostgreSQL and object storage are provided by Supabase; Pinecone stores derived vectors; external providers supply embeddings, reranking, generation and voice features. Provider and persistence details are implemented in backend adapters and routers; this document is not a substitute for their schemas.

## Trust and audience boundaries

- **Public:** unauthenticated citizen discovery and Q&A may access only documents that pass one server-side publication-eligibility policy. An ID, vector namespace, model choice or cache flag supplied by a caller is never authority.
- **Citizen:** authenticated `/me` operations derive identity from a verified token subject and scope every read/write to that subject. Client-supplied owner IDs are not proof of ownership.
- **Admin:** a signed-in user is not an administrator. A trusted, revocable server-side grant source and audited operation-specific permissions are a proposed design; no approved grant source was recorded. Privileged document mutations remain disabled/fail-closed in local source pending verification.
- **Research/internal:** distinct researcher or internal permission is required; it must not be inferred from login or admin status. Evaluation handlers currently return 503 in local source; keep internal reads and mutations disabled until a decision and tested authorization exist.
- **Machine/Telegram:** machine credentials and fixed scope are separate from citizen identity. Anonymous history merge is disabled; do not treat browser IDs as credentials.
- Route groups, hidden navigation, Clerk presence, service-role database access and a hard-to-guess URL are not authorization controls.

These boundaries are security requirements. The proposed role/grant architecture remains a future decision; do not represent it as deployed.

## API contracts and compatibility

Backend route definitions and Pydantic models are the implementation contract. Preserve existing v1 and legacy paths and response shapes while clients (web and mobile) depend on them. The architecture papers recommend additive versioned contracts and adapters rather than incompatible changes to a path; this is a recommendation, not a recorded approval. Test old clients and SSE behavior before any contract change.

Important compatibility constraints from the audit papers:

- `/api/v1/me` ownership comes from verified identity, never request owner fields.
- Existing history/conversation/share clients have established response envelopes and history scope parameters; inspect current routers and mobile callers before changing either.
- Chat and evaluation streaming use SSE. Preserve event framing, abort/disconnect behavior and completion semantics for both clients.
- Public Q&A must not expose arbitrary document namespaces, privileged model/provider controls, or internal diagnostics.
- PDF preview/download, public shares, voice multipart requests and anonymous feedback have distinct anonymous/binary/streaming policies; do not assume a generic JSON client is a drop-in contract.

No generated API contract is maintained. Treat backend route/schema source as authoritative and update clients only with compatibility review.

### Compatibility period recommendation

Preserve the existing interface for **at least 90 days after its replacement is production-ready**, and require measured adoption before retiring it. Ninety days is a recommendation from the architecture papers, not an approved deadline or policy. No sunset is authorized until owners approve it.

## Proposed streaming and cache contracts

The following are proposed contracts, not claims about current implementation or production behavior. They require owner approval, infrastructure proof and web/mobile regression coverage before rollout.

### C2 — Streaming withdrawal and leases

Buffer the answer, verify its sources, then atomically acquire a short lease from the authoritative publication store. Serialize lease acquisition with withdrawal; lease commit is the authorization point. Withdrawal blocks all new leases and is acknowledged as effective only after outstanding leases finish or expire. The proposed maximum lease duration is **10 seconds**; it is not approved or measured and requires infrastructure proof. Do not hold a database lock during generation. Stop emission when the lease expires. Bytes already queued or delivered cannot be recalled, and lease duration alone does not bound network delivery latency. If coherent authority and expiry cannot be demonstrated, do not release publication-aware streaming.

### C5 — SSE persistence, completion and recovery

For the proposed answer-run SSE contract, emit progress only before verification/lease. Commit the authenticated final answer and its idempotency state atomically **before** emitting `complete`; anonymous answers are unsaved. If failure occurs after response headers, emit exactly one `error` event and never emit `complete`. Persistence returning `False` is failure. On disconnect after commit, recovery uses authorized status lookup and replay, rechecking current eligibility. Matching actor, idempotency key and request body must not repeat provider work; reuse of the key with a changed body returns HTTP 409. Suggestions are best effort and may follow `complete`. These semantics are proposed, not present-contract claims.

### C6 — Mobile authentication and retry

Retry a pre-stream HTTP 401 at most once with a refreshed bearer token and the **same** idempotency key, and only when the denial is known to precede work or idempotency is proven. Do not refresh on HTTP 403. Treat HTTP 503 as service availability failure, not authentication failure. Otherwise require reauthentication. Anonymous continuation requires explicit user consent, a new idempotency key and no private context. Never silently downgrade an authenticated request to anonymous. This is a proposed mobile contract; verify SDK behavior and old/new client fixtures before implementation.

### C7 — Answer-cache release gate

Disable answer caching until authoritative eligibility enforcement is integrated. If later enabled, restrict it to public, single-document, no-history results. Include scope, document revision, source, policy epoch, model version and prompt version in cache keys. Recheck every cited document revision on every hit and apply the C2 lease requirements. Policy or eligibility service unavailability fails closed. Epoch change is authoritative; broadcast eviction is only an optimization. These are proposed release conditions, not verified current cache behavior.

## Data and publication lifecycle

The intended lifecycle in the working papers is `draft → review → approved → published → suspended/expired`, with controlled transitions and renewed approval for a new revision. Public eligibility should require a known approved source, explicit human approval, public visibility, published state, ready processing, current version and valid effective/expiry/revocation state. Unknown or unclassified records deny by default. `ready` alone, a successful upload, or Telegram ingestion must never auto-publish.

These lifecycle rules are **proposed constraints, not verified runtime enforcement**. Earlier audits report that the publication helper was not called by catalogue, status, PDF or retrieval paths, and that a migration does not prove live database state. Confirm current callers and deployed policies before treating publication isolation as implemented.

Supabase schema/migrations are the source of truth for checked-in database structure. Apply reviewed, additive migrations with backfill inventory, validation and rollback planning; do not infer deployed grants, RLS or storage policies from SQL files in this repository.

### C4 — Permission and credential cutover

Before changing credentials, grants or permissions, follow this proposed sequence: (1) inventory every operation currently using the Supabase anon key; (2) introduce actor- and eligibility-scoped server repositories; (3) verify effective database roles and permissions; (4) transition one operation at a time; (5) revoke old permissions only after the replacement is proven. Do not assume Clerk `sub` maps to Supabase `auth.uid()`. Rollback remains deny-first; never restore insecure anonymous access as a shortcut. This sequence does not establish that live roles or permissions were inspected.

## Retrieval, citations and caches

- Resolve every selected document and retrieved chunk through the same authoritative eligibility/ownership policy before returning text or citations.
- Treat uploaded text and retrieved passages as untrusted prompt content. They cannot override instructions, grant access, invoke privileged actions or establish citation truth.
- Return only citations grounded in retrieved source records; enforce source/document identity and page provenance, and abstain or suppress affected output when verification is incomplete.
- Revalidate public shares and their source eligibility on each read, including generated metadata/images. Proposed policy is to suppress the whole share when evidence is missing or ineligible; that behavior requires implementation verification.
- Personal caches must be identity/session scoped and invalidated on account changes. Revocable/private content must not be served from stale offline caches without authoritative revalidation. Prior audits flagged global browser cache keys; confirm current source before claiming remediation.
- Proposed offline behavior has TTL zero for personal or revocable content and is limited to a static shell. Purge legacy caches and legacy cache keys. Do not promise remote erasure of bytes already copied or held by disconnected devices.

## Implementation constraints

1. Fail closed on missing identity, permission, source classification, database policy or verification evidence.
2. Preserve existing client compatibility and mobile support until an approved sunset and measured adoption period.
3. Keep server-side service-role access behind equivalent ownership, eligibility and audit checks.
4. Do not enable publication, admin, research, anonymous merge, public results claims, or long-lived PDF URLs based only on this proposal.
5. Distinguish local tests/source evidence from live Supabase, provider, deployment and traffic evidence.

## Decisions still required

The architecture register contains recommendations, not approvals. Product/security/technical owners still need explicit decisions and evidence for: admin and researcher grant sources; publication approval and source authority/freshness; anonymous merge (which remains disabled); public results scope; mobile support and compatibility sunset; evaluation retention/consent; PDF proxy versus signed URL; rate budgets and trusted proxy topology; treatment of legacy shares with missing evidence; reviewed backfill/rollback; and internal operator permissions. Until resolved, keep dependent operations disabled or deny by default.
