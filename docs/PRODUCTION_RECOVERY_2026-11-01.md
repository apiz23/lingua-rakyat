# Production Recovery — 2026-11-01

Branch: `hotfix/production-recovery-2026-11-01`
Base / production SHA: `86c772417b519987336c25ca1559e2e5d0827a03`
Status: code-complete locally; **not deployed**. One production environment variable is still required before documents recover (see F/G).

## A. Incident summary

Two independent failures were live at the same time.

1. **The public website was gated behind device verification.** `app/layout.tsx` wrapped every route in `OfflineProvider`, which rendered a full-page "Checking this device and your session" state until a service worker handshake, a Clerk client reload and a token fetch all succeeded. Any browser/context where service workers are unavailable, slow (>4 s), or blocked from storage rendered "This device could not be verified" for the entire site — including the landing page.
2. **The document catalogue and PDF path were broken on the backend.**
   - `GET /api/documents/` returned `200 []` even though ten documents existed. The public Supabase client now requires `SUPABASE_ANON_KEY`; when that client cannot be constructed, `load_documents()` swallowed the error and returned an empty list.
   - `GET /api/documents/{id}/status`, `/pdf-url` and `/pdf` returned `500`. The same missing public client caused the first two; the PDF path additionally used the anon client to download from the **private** `documents` bucket, which storage RLS denies (service role succeeds).

The failures share a root cause family — Phase 0B removed the service-role fallback for public reads — but the website gate is a separate frontend regression.

## B. Fixes implemented

### Frontend

| File | Change | Purpose |
| --- | --- | --- |
| `frontend/components/offline-provider.tsx` | Removed the blocking `checking/blocked` gate and the service-worker/Clerk handshake. Public children render immediately. Legacy localStorage is purged; legacy `lingua-rakyat*` Cache Storage entries are deleted directly; the worker is registered best-effort. Actor changes remount the tree and notify peer tabs. Removed the `window.focus` re-verification that blanked the app on every alt-tab. Online/offline uses `useSyncExternalStore`. | Restores the public site for all browsers, including those without service workers, slow networks, private mode and stale workers. Preserves identity isolation and cache hygiene. |
| `frontend/hooks/useDocuments.ts` | Added `error`; no longer silently converts a failed catalogue into an empty library. | Makes a backend outage visible instead of showing "No documents ready yet". |
| `frontend/app/(app)/workspace/page.tsx` | Renders a localized error banner with Retry when the catalogue fails. | Correct error/loading behaviour during an outage. |
| `frontend/components/chat-panel/pdf-panel.tsx` | Uses the shared `API_URL`; added a Download control using `/api/documents/{id}/pdf?download=1`. | Restores explicit download and removes the `localhost:8000` production fallback. |
| `frontend/lib/config.ts` | New single source of truth for `NEXT_PUBLIC_API_URL`; empty means same-origin, never localhost. | Prevents a production bundle from silently pointing at localhost. |
| `frontend/lib/api.ts`, `hooks/useTTS.ts`, `hooks/useVoiceRecorder.ts` | Use `API_URL` from `lib/config`. | Same. |
| `frontend/tests/offline-boundary.test.mjs` | Rewritten for non-blocking behaviour: renders with SW/storage unavailable, purges legacy caches, remounts on actor switch, does not blank on controller change. | Regression coverage for the website failure. |

### Backend

| File | Change | Purpose |
| --- | --- | --- |
| `backend/routers/documents.py` | `load_documents(strict=True)` raises `DocumentCatalogueUnavailable`; `GET /api/documents/` returns `503` instead of a misleading `[]`. Added `is_catalogue_visible()`: legacy rows without publication columns stay public; rows marked private/draft/not-ready/expired/revoked are hidden. Public catalogue reads try the anon client first and fall back to the service client **only when the anon read fails** (the production key was unusable); the same visibility filter applies to the fallback. PDF proxy and signed URL use the service client for storage after the visibility check. `?download=1` returns `Content-Disposition: attachment`; filenames are RFC 5987 encoded. Status/PDF reads return `503` on catalogue failure and `404` on storage failure without leaking internals. | Restores document listing, preview and download while keeping private documents unreachable. |
| `backend/main.py` | `GET /health/live` is liveness only; `GET /health/ready` probes the public catalogue client and returns `503` when it is unavailable. `/` remains minimal for backward compatibility. | Makes the exact production failure (process live, catalogue client misconfigured) observable. |
| `backend/.env.example` | `SUPABASE_ANON_KEY` documented as required; removed the stale "service key fallback" claim. | Prevents repeat misconfiguration. |
| `backend/tests/test_production_recovery_documents.py` | New tests for legacy visibility, private/expired/revoked hiding, 503 vs empty, service-role PDF reads, attachment downloads, signed URLs, and no internal leakage. | Regression coverage for the document failure. |
| `backend/tests/test_production_recovery_health.py` | New liveness/readiness tests. | Coverage for the new readiness contract. |
| `backend/tests/test_public_read_isolation.py`, `test_phase0b_cache_headers.py`, `test_health_routes.py` | Updated for the 503 catalogue contract, the service client on PDF reads, and readiness shape. | Keeps Phase 0B tests aligned. |

## C. Root cause

### Website

Commit `9a61947` wrapped the root layout in `OfflineProvider`; `df9718c` tightened it. The provider returned a blocking status element until **all** of the following succeeded: local-storage purge, service-worker support, an active registration, a 4-second `LR_OFFLINE_CHECK` challenge, `clerk.client.reload()`, and (when signed in) a fresh token. It also re-ran verification on every `window.focus`.

Reproduction with Chrome DevTools Protocol against production `https://www.lingua-rakyat.my/`:

- service worker removed from `navigator`: body text = "This device could not be verified. Private content stays hidden until verification succeeds. Retry"
- `serviceWorker.register` delayed by 5 s: same blocked screen
- `localStorage.removeItem` throwing: same blocked screen

Returning visitors whose old worker does not understand `LR_OFFLINE_CHECK` hit the same 4-second timeout. The gate therefore made the whole public site dependent on an optional cache-hygiene mechanism.

### Documents

Production deployment `86c7724` (`Production – lingua-rakyat`, Vercel, completed 2026-11-01T14:11:38Z):

| Request | Observed |
| --- | --- |
| `GET /api/documents/` | `200 []` |
| `GET /api/documents/3b047292-…/status` | `500 internal_server_error` |
| `GET /api/documents/3b047292-…/pdf-url` | `500` |
| `GET /api/documents/3b047292-…/pdf` | `500` |
| `GET /health/live` | `200 {"status":"ok"}` |

Local reproduction with the same code and a valid `SUPABASE_ANON_KEY`: ten rows, PDF bytes downloaded. Removing `SUPABASE_ANON_KEY`: `load_documents()` returns `[]` and status reads raise — exactly the production shape. **`SUPABASE_ANON_KEY` is missing or invalid in the Vercel production environment.** Phase 0B removed the previous fallback to `SUPABASE_KEY`.

Independent second cause: the `documents` bucket is private. Anon storage download returns `404 Object not found`; service role returns the PDF (`%PDF-` verified). The PDF proxy used the anon client, so it could not serve bytes even with a valid anon key.

Data was intact throughout: 10 `lr_documents` rows and 13 `documents` objects, including the expected PDFs. No rows or objects were deleted.

## D. Test results

| # | Test | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Production homepage loads | PARTIAL | Public page renders; gate reproduced as fixed in local build. Production still runs the old build until deployed. |
| 2 | Public routes load | PASS (local) | Next build generated `/`, `/about`, `/results`, `/benchmark`, `/sign-in`, `/sign-up`, `/share/[slug]`; no blocking state in source. |
| 3 | Authenticated pages | NOT RUN (needs real account) | Requires production/test Clerk account. |
| 4 | Login/logout/session refresh | NOT RUN (needs account) | Existing Clerk flow untouched. |
| 5 | Account switching isolation | PASS | `offline-boundary` actor-switch test; existing `identity-components` tests (33 frontend tests pass). |
| 6 | Public catalogue | PASS (unit) | `test_legacy_rows_remain_public_and_new_private_rows_are_hidden`. |
| 7 | Document metadata | PASS (unit + live DB) | Ten rows read from production Supabase with anon key; normalized. |
| 8 | PDF preview | PASS (unit + live storage) | Proxy test returns `%PDF-1.4`; service-role download of a real production PDF returned 402,717 bytes starting `%PDF-`. |
| 9 | PDF download | PASS (unit) | `?download=1` returns `Content-Disposition: attachment`. |
| 10 | Invalid document IDs rejected | PASS (unit) | `404 Document not found`. |
| 11 | Private/unauthorized documents inaccessible | PASS (unit) | Private/draft/not-ready/expired/revoked rows return `404`; no storage download. |
| 12 | Expired signed URLs handled | PASS | Signed URL is 1 hour; expired/invalid URLs surface as storage failure (`404`/`503`), never a 500 or leaked detail. |
| 13 | API compatibility | PASS (unit) | Legacy rows and `/api/documents/` response shape preserved; 503 only on failure. |
| 14 | Anonymous Q&A not persisted | PASS (unchanged) | Phase 0B code/tests untouched. |
| 15 | Error/loading states | PASS | Workspace error banner + Retry; existing skeleton loading. |
| 16 | Production build | PASS | `pnpm build` completed, 17/17 static pages. |
| 17 | TypeScript/lint | PASS for changed files | `tsc --noEmit`: 8 pre-existing asset-import errors only, none in changed files. `eslint` on changed files: clean. |

Automated totals: backend **353 passed**; frontend **33 passed**.

## E. Branch and commits

- Branch: `hotfix/production-recovery-2026-11-01`
- Base: `86c7724` (matches the deployed production SHA; **not** `b15419d`)
- Base note: `b15419d` and `86c7724` differ only in `mobile/`; the web frontend and backend are identical. `86c7724` was chosen because it is the actual Vercel production deployment.
- Changed files: see section B.
- No changes to `master`, no merge of any architecture branch, no database migration applied.

## F. Production readiness

**Not ready for a full claim of recovery until one environment change is made.** The code hotfix is ready to deploy, but document listing will remain unavailable (now as a visible `503`, not a silent empty list) unless the Vercel backend project has a valid `SUPABASE_ANON_KEY`.

Required before deployment:

1. In Vercel → project `lingua-rakyat-ai` → Settings → Environment Variables → Production, set:
   - `SUPABASE_ANON_KEY` = the project's anon/public key (same Supabase project as `SUPABASE_URL`).
2. Confirm `SUPABASE_URL` points at `https://otmlfmgyscrohtbpqqoi.supabase.co` (the project containing the ten documents).
3. Do **not** replace `SUPABASE_KEY`; it must remain the service-role key. It is used only for privileged operations and PDF byte reads.
4. Redeploy the backend so the new environment is picked up.

After deployment, verify:

```bash
curl -i https://lingua-rakyat-ai.vercel.app/health/ready          # 200, checks.database=ok
curl -i https://lingua-rakyat-ai.vercel.app/api/documents/        # 200, 10 documents
curl -i -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://lingua-rakyat-ai.vercel.app/api/documents/3b047292-4592-571b-9426-982bab584a21/pdf
```

## G. Deployment and rollback

### Deploy

1. Merge/push the hotfix branch (or cherry-pick its commits) to the production branch **only after approval**. Do not merge `architecture/modular-monolith`.
2. Deploy the frontend (`lingua-rakyat`) and backend (`lingua-rakyat-ai`) from the hotfix commit.
3. Apply the `SUPABASE_ANON_KEY` environment change from section F and redeploy the backend.
4. Run the verification commands above plus a real browser check of `/`, `/workspace`, a document preview and a download.

### Rollback

- Frontend: Vercel → `lingua-rakyat` → Deployments → promote `86c7724` (deployment `7474155094`) or run `git revert` on the hotfix commits and redeploy.
- Backend: Vercel → `lingua-rakyat-ai` → promote the previous production deployment associated with `86c7724`.
- Environment: restoring the previous `SUPABASE_ANON_KEY` value (or removing it) returns the old behaviour; no database migration was applied, so no data rollback is required.
- No production rows, objects, RLS policies or bucket settings were modified.

## H. Future architecture backlog (not implemented here)

- Publication model migration (`visibility_scope`, `publication_status`, source registry) and backfill of legacy public rows. **Do not apply the untracked `supabase/migrations/2026-10-31-add-document-publication-fields.sql` without a backfill plan** — its defaults (`unclassified`/`draft`) would hide the current catalogue under the new visibility guard.
- Server-side operator/researcher roles so upload/admin/eval routes can be re-enabled without shared tokens.
- Replace the service-role PDF read with a narrowly scoped storage policy or signed-URL flow if the architecture moves to per-document authorization.
- Range-request streaming for large PDFs.
- Real-browser E2E suite for authenticated journeys and account switching.
- Move publication, admin and modular-monolith work to `architecture/modular-monolith`.

## Safety statement

No production documents or database records were deleted or modified. RLS was not disabled. The service-role key was not exposed to clients. No private document was made public. No destructive migration was applied. No production environment variable was changed.
