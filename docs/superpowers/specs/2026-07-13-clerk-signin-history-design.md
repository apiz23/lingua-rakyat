# Clerk Sign-In, Synced History & My Shares — Design

**Date:** 2026-07-13
**Status:** Approved for planning

## Goal

Optional Clerk sign-in that (a) syncs chat history across devices, (b) adopts
the device's anonymous history into the account on first sign-in, and
(c) gives signed-in users a "My shares" list with revoke. Anonymous users
keep working exactly as today — nothing is gated behind sign-in.

## Background / Current State

- Identity today is an anonymous UUID in localStorage (`lr-user-id`,
  `frontend/app/(app)/workspace/page.tsx:16-24`, fallback in
  `chat-panel/index.tsx:308-333`). It is client-supplied, per-browser, and
  the backend trusts it blindly.
- History already persists server-side: Supabase `lr_chat_messages`
  (`supabase/schema.sql:16-32`), written by `POST /api/chat/ask` and
  `/ask-stream` via `_history_payload` (`backend/routers/chat.py:112-129`),
  read by `GET /api/chat/conversations` and `GET /api/chat/history`.
  `ConversationSidebar` lists sessions per user. So sign-in adds
  cross-device sync and durability, not persistence itself.
- Shares (`lr_shared_answers`) have no ownership column; nothing links a
  share to a user. `POST /api/share` / `GET /api/share/{slug}` are
  anonymous.
- No auth anywhere: the browser fetches FastAPI directly
  (`NEXT_PUBLIC_API_URL`, `frontend/lib/api.ts:13`); no middleware, no
  tokens. The only credential is the unrelated document `upload_token`.

**Decisions already made:** Clerk (chosen over Supabase Auth); optional
sign-in; backend verifies Clerk JWTs (client-supplied IDs are not trusted
for signed-in data because Clerk user IDs are not secret); My shares =
list + revoke; architecture = direct FastAPI calls with JWT verification
(no Next.js proxy layer — streaming and offline cache stay untouched).

## Design

### 1. Identity model

**Backend — `resolve_identity` FastAPI dependency** (new
`backend/utils/auth.py`):

- `Authorization: Bearer <token>` present → verify the JWT signature
  against Clerk's JWKS (PyJWT with `cryptography`; JWKS fetched from
  `{CLERK_ISSUER}/.well-known/jwks.json` and cached in-process; validate
  `iss` and `exp`). Valid → identity = Clerk `sub` claim (`user_…`),
  `is_authenticated = True`. Invalid/expired/malformed → **401** — never a
  silent fallback to the anonymous path.
- No header → identity = the client-supplied `user_id`
  (query param or body field, as today), `is_authenticated = False`. The
  anonymous path's behavior is byte-identical to current behavior.
- Applied to: `POST /api/chat/ask`, `POST /api/chat/ask-stream`,
  `GET /api/chat/conversations`, `GET /api/chat/history`,
  `DELETE /api/chat/history/{document_id}`, `POST /api/share`, plus the
  new endpoints below. When a token is present, the resolved identity
  **overrides** any client-supplied `user_id` — including in
  `_history_payload`, so signed-in writes cannot be attributed to a
  spoofed ID.

**Frontend — `@clerk/nextjs`:**

- `ClerkProvider` in the root layout; sign-in button (modal) and
  `UserButton` in the workspace header. Clerk app configured in the
  dashboard with Google + email (user action).
- The existing fetch helper in `lib/api.ts` gains an async token source:
  when signed in, attach `Authorization: Bearer ${await getToken()}` to
  API calls. When signed out, no header — requests look exactly like
  today's.
- Effective user ID for UI-driven queries: Clerk user ID when signed in,
  else localStorage `lr-user-id`.

### 2. History sync + first-sign-in merge

- While signed in, ask/history/conversations run under the Clerk ID, so
  any signed-in device sees the same conversations.
- **Merge:** `POST /api/user/merge-anon` with body
  `{ anon_user_id: string }`, auth **required**. Backend runs, in order:
  `update lr_chat_messages set user_id = <clerk_sub> where user_id = <anon_id>`
  and
  `update lr_shared_answers set user_id = <clerk_sub> where user_id = <anon_id>`.
  Idempotent — re-running matches zero rows. Returns counts
  `{ chat_rows: n, share_rows: m }`.
- Frontend trigger: when signed in and `lr-user-id` exists in
  localStorage, call merge once; **only on success** remove `lr-user-id`.
  Failure is non-fatal — retried on next page load.
- Sign-out: mint a fresh anonymous UUID (the old one was consumed by the
  merge). The device starts clean; the account history is intact
  server-side.
- Guard: `anon_user_id` must not look like a Clerk ID (reject values
  starting with `user_`) so one account cannot merge another account's
  rows.

### 3. Share ownership + My shares

- `lr_shared_answers` gains nullable `user_id text` — `NULL` = anonymous
  or legacy share: it works exactly as today and can never be revoked.
- `POST /api/share`: stamp `user_id` when the request carries a valid
  token; otherwise store `NULL` (anonymous users can still share).
- `GET /api/share/mine` (auth required): newest-first
  `[{ slug, question, confidence_label, agency, created_at }]`.
- `DELETE /api/share/{slug}` (auth required): delete only when
  `user_id` matches the token's `sub`; the public `/share/[slug]` page
  404s afterward. 403 for non-owner, 404 for unknown slug.
- UI: `/shares` page in the `(app)` route group — list with question,
  confidence chip, agency, date, copy-link button, revoke button
  (confirm dialog). Linked from the header user menu. Signed-out visitors
  see a sign-in prompt instead of the list.

### 4. Schema changes (manual, in the Supabase SQL editor)

```sql
alter table lr_shared_answers add column if not exists user_id text;
create index if not exists idx_lr_shared_answers_user_id
  on lr_shared_answers(user_id);
```

`lr_chat_messages` needs no change (`user_id` is already plain text).
Unlike the OG-card migration, nothing breaks if this runs late: the
backend must treat the column as optional on read, and only `/mine`,
revoke, and owner-stamping depend on it.

### 5. Configuration

- Backend: `CLERK_ISSUER` (e.g. `https://<slug>.clerk.accounts.dev`, or
  the production Clerk domain). New deps: `PyJWT`, `cryptography`.
- Frontend: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
- User actions: create the Clerk application (Google + email), set the
  env vars locally and on the deploy targets, run the SQL migration.

## Error Handling

- Bad/expired token → 401. The frontend fetch wrapper retries once with a
  fresh `getToken()` (Clerk session tokens are short-lived by design).
- JWKS unreachable → 503 on token-bearing requests only; anonymous
  requests never touch JWKS and are unaffected.
- Merge failure → non-fatal, logged, retried next load; `lr-user-id` is
  only cleared after a successful merge.
- Revoke: 403 non-owner, 404 unknown slug; anonymous/legacy shares
  (NULL owner) are not listed and cannot be revoked by anyone.
- Pre-migration reads: backend tolerates a missing `user_id` column on
  `lr_shared_answers` reads (`.get("user_id")`), consistent with the
  old-row tolerance pattern already in `fetch_share`.

## Testing

- **Backend (pytest):** generate a local RSA keypair; monkeypatch the
  JWKS cache with the public key; mint test JWTs. Cases: valid token →
  identity = `sub`; expired / wrong issuer / garbage → 401; no token →
  anonymous fallback identical to today (regression on existing 79
  tests); token overrides body `user_id` in `_history_payload`; merge
  updates both tables and is idempotent; merge rejects `user_`-prefixed
  `anon_user_id`; share owner stamping (token vs none); `/mine` returns
  only the owner's shares; revoke owner-only (403/404 paths).
- **Frontend:** `pnpm build`. Manual: sign in → ask → second browser
  signed in shows same history; anonymous device history appears in the
  account after first sign-in; revoke → public share page 404s;
  signed-out flow unchanged.
- **Post-deploy:** repeat the cross-device check on lingua-rakyat.my.

## Out of Scope

- Supabase RLS (backend service key remains the only DB client).
- Per-user rate limits, account deletion/export, admin views.
- Linking Telegram bot identity to Clerk accounts.
- Gating any existing feature behind sign-in.
- Un-merge / splitting an account back into anonymous devices.
