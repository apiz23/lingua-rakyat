# UI-01D ? interaction remediation and authenticated verification

## Executive summary

Both original interaction failures are resolved in focused runtime tests. Serial Chromium smoke: 6/6 passed (UI-01C: 3/6). Focused sidebar/research regression: 10/10 passed across 375, 430, 768, 1024 and 1440px. Unit tests: 27 passed. Authenticated real-data verification remains BLOCKED: the existing shared browser profile has Clerk loaded but no signed-in user, and no existing test storageState/account was supplied. An asynchronous request to sign in to a non-production test account was sent; no session became available during execution. No credentials were requested in chat, no account was created and no authorization was bypassed.

UI-01D remediation is verified; authenticated portion is explicitly blocked. UI-01C and overall UI-01 are not closed.

## Repository safety

Canonical cwd verified: C:/Users/Hafizuddin/Desktop/Developer/lingua-rakyat. Branch reconstruction/lingua-rakyat-architecture-2026-11-03; HEAD 86af77cd13b34e817547925f72284558c19198df. Starting full status inspected: UI-01C dirty frontend plus pre-existing backend/schema/migration/.gitignore work. All retained. No commit/push/merge/deploy or backend/database/middleware/Clerk change. Only servers started by this run on port 3012 were stopped; original developer server on 3000 was preserved. No cache/artifact deletion. Next's test-server-generated tsconfig changes were restored to the initially unchanged content.

## Original failures and root causes

### Sidebar Escape and focus

Reproduced before remediation. UI-01C's window-level Escape reset was overly broad. Radix document dismissal listener registration could lag behind the opening/focus event; immediate Escape after focus-in could leave the sheet open. Direct dialog-scoped React onKeyDown now handles Escape only when the closest role=dialog is this sheet, avoiding nested-dialog dismissal. Removed broad window Escape handling. The custom SidebarTrigger is not a Radix Dialog.Trigger, so automatic restoration did not reliably return focus to it. Provider records the opener and onCloseAutoFocus restores it if still connected. No manual global listener was added. Existing shortcut effect retains cleanup.

Also found duplicate Ctrl+B listeners in AppShell and SidebarProvider; both could toggle one keypress twice. Removed AppShell's duplicate, leaving shared provider behavior. Desktop collapse and expansion now pass by both shortcut and trigger; Escape leaves desktop collapse unchanged.

### Research section switching

Reproduced the UI-01C no-op click immediately after static markup appeared. After hydration the same existing setActiveTab handler worked for pointer and Enter. Earlier scan did not wait for a usable client session and checked state immediately. Production handler was correct: no speculative research-function changes made. New tests wait for Clerk readiness, use the named Evaluation sections navigation, assert pressed states with retries, assert accuracy content appears, then select Language Simplification by keyboard and assert accuracy content hides. All five widths pass. Evaluation/benchmark data-generation operations were not executed.

### Share smoke failure

Actual share page getShare runs server-side, including metadata fetch. page.route only intercepts browser requests, so the old fixture was never seen and the share rendered not-found. Contract itself was correct. Replaced browser interception with a test-process-only global fetch fixture loaded using NODE_OPTIONS. It handles only GET /api/v1/public/shares/qa-smoke and delegates every other fetch, including Clerk, unchanged. It is NOT imported by application code and requires UI01D_SHARE_FIXTURE=1. Normal share parsing/validation remains intact. The original response status/question assertion now passes. This is valid fixture content, not an authenticated real share or production data.

### Sign-up smoke failure

UI is intentionally Create account and uses existing Clerk flow. Old test expected Sign up. Updated only the incorrect expected wording; status and visibility assertions remain.

### Signed-out administration smoke failure

Existing server layout correctly redirects signed-out requests to /sign-in?redirect_url=%2Fmanage. Old test incorrectly expected admin navigation to be visible. Corrected test positively asserts the redirect destination and return path, sign-in heading, and absence of administration/research navigation. No production guard changed.

## Additional runtime blockers investigated

A Next server bound to 127.0.0.1 reproduced internal proxy ECONNRESET/socket hang up against localhost:3012. Default binding plus localhost test origin allowed successful requests. This is evidence of a host/bind interaction, not proof of all historical failures. Separate test server uses .next-ui01d only when UI01D_TEST_SERVER=1, preserving the live developer server's cache.

A later 500 exposed malformed generated CSS containing binary characters in a shadow candidate. Tailwind scanned QA traces/generated test output. Excluded qa and .next-ui01d using @source not; subsequent smoke and focused suites passed. No trace or cache was deleted. Test output directories are separate so simultaneous suites cannot overwrite each other's trace artifacts. Local git info/exclude ignores generated .next-ui01d only; existing .gitignore was not modified by this task.

## Verification evidence

| Check | UI-01C | UI-01D |
|---|---|---|
| TypeScript | Passed | Passed |
| Frontend unit | 27 passed | 27 passed |
| Serial Chromium routes | 3 passed / 3 failed | 6 passed |
| Focused interactions | 3 passed / 2 unresolved | 10 passed, all five widths |
| Production build | Passed | Passed |
| Changed UI-01D TS/config lint | Existing warnings | Passed (final run after unused import cleanup) |
| Whitespace | Passed | Passed |

Initial intermediate failures were retained in QA outputs; final successful results are qa/ui01d-focused-pass and qa/ui01d-smoke-pass. Runs before CSS exclusion failed with 500/readiness timeouts; these were runtime/tooling regressions investigated and fixed, not suppressed. No tests deleted, skipped, or assertions weakened. New test-file syntax error during development was corrected before final validation.

## Sidebar and research responsive regression

| Width | Sidebar | Research | Shared fixture |
|---|---|---|---|
|375|Open, focus enters dialog, Escape, focus return, close button pass|Pointer, Enter, content/active state pass|No page overflow|
|430|Open, focus enters dialog, Escape, focus return, close button pass|Pointer, Enter, content/active state pass|No page overflow|
|768|Ctrl+B collapse, Escape stable, trigger expansion pass|Pointer, Enter, content/active state pass|No page overflow|
|1024|Ctrl+B collapse, Escape stable, trigger expansion pass|Pointer, Enter, content/active state pass|No page overflow|
|1440|Ctrl+B collapse, Escape stable, trigger expansion pass|Pointer, Enter, content/active state pass|No page overflow|

Sidebar exercised through the legitimate signed-out citizen workspace using the same component/provider as admin. This verifies the shared mechanism, not the authenticated admin shell. Populated admin tables/dialogs/profile are not covered. Prior unchanged UI-01C signed-out containment results retained; no repeat of all 110 checks.

## Authenticated route matrix

| Route | Runtime status | Reason |
|---|---|---|
|/manage|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/documents|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/documents/[id]|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/ingestion|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/sources|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/review|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/publications|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/audit|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/users|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/manage/status|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/profile|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/shares|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/workspace|BLOCKED for authenticated content|No legitimate authorized test session; signed-out boundary only|
|/share/[slug]|Fixture verified; real shared content BLOCKED|No existing non-production real share supplied|

No populated dashboard, revision detail, ingestion jobs, queue, publication record, audit entry, role record, real profile or shares are claimed verified. No search/pagination/review/promotion/rollback mutation was performed. Admin layout authorization remains unchanged; no production data read for testing.

## Screenshots

qa/ui01d-share-fixture-375.png and -1440.png show explicitly test-only valid public share rendering. qa/ui01d-eval-375.png and -1440.png show research surfaces. No authenticated screenshots could safely be captured. Additional diagnostic eval capture retained. Do not present fixture images as real account data.

## Exact UI-01D files

- frontend/components/ui/sidebar.tsx ? dialog-local Escape, opener focus restoration, remove broad Escape.
- frontend/components/app-shell.tsx ? remove duplicate keyboard shortcut listener and unused image import.
- frontend/app/globals.css ? exclude QA and generated test output from Tailwind scanning.
- frontend/next.config.mjs ? opt-in isolated UI test dist directory.
- frontend/playwright.config.ts ? opt-in external-server and hostname support; default behavior preserved.
- frontend/e2e/routes.spec.ts ? correct three incorrect test assumptions, retain coverage.
- frontend/e2e/ui01d.spec.ts ? ten focused responsive pointer/keyboard/focus tests.
- frontend/qa/ui01d-share-fetch.cjs ? narrowly scoped server-side test fetch fixture.
- frontend/qa/ui01d-diagnose.mjs, ui01d-click.mjs ? retained reproduction scripts.
- frontend/qa/ui01d-responsive.mjs, ui01d-responsive.json ? targeted fixture/research scan.
- frontend/qa/UI-01D-report.md ? this report.
- frontend/qa/ui01d-*.png and ui01d-* result directories ? captures and diagnostic/final results.
- .git/info/exclude ? local-only exclusion for generated isolated Next output.

Existing UI-01C changes and artifacts remain user-owned and preserved.

## Reproduction

From frontend, start a separate local fixture server (not production):

    $env:UI01D_SHARE_FIXTURE='1'
    $env:UI01D_TEST_SERVER='1'
    $env:NODE_OPTIONS='--require=C:/Users/Hafizuddin/Desktop/Developer/lingua-rakyat/frontend/qa/ui01d-share-fetch.cjs'
    node ./node_modules/next/dist/bin/next dev --port 3012

In a separate shell:

    $env:PLAYWRIGHT_PORT='3012'
    $env:PLAYWRIGHT_HOST='localhost'
    $env:PLAYWRIGHT_EXTERNAL_SERVER='1'
    pnpm exec playwright test e2e/routes.spec.ts --project=chromium --workers=1 --output=qa/ui01d-smoke-results

Focused tests against existing developer server:

    $env:PLAYWRIGHT_PORT='3000'
    pnpm exec playwright test e2e/ui01d.spec.ts --project=chromium --workers=1 --output=qa/ui01d-focused-results

Do not run the valid-share smoke test against a server without the SSR fixture and assume browser interception covers it. Fixture environment is opt-in and not deployed. The test server created by this execution was stopped afterward.

## Remaining limitations and closure

Existing browser profile: Clerk loaded, signedIn=false, /manage redirected to sign-in. No test account/storageState supplied. Legitimate sign-in is necessary to finish authenticated data verification. No destructive actions or production mutations allowed. Benchmark operations, nested dropdown/overlay combinations, authenticated long records, all CRUD success/error paths, and real shared content remain unverified. UI-01C and overall initiative stay open. Source implementation and focused remediation are ready for review; do not equate fixtures with authenticated completion.

## Final Git snapshot

Branch reconstruction/lingua-rakyat-architecture-2026-11-03; HEAD 86af77cd13b34e817547925f72284558c19198df unchanged. 57 status entries (starting 50), including all pre-existing work, new focused test and local QA artifacts. Tracked frontend aggregate diff versus HEAD: 24 files, 153 insertions, 137 deletions; this aggregate includes preserved UI-01C changes. No staged changes or commits created. Final TypeScript and changed-file lint exit 0; final production build exit 0.
