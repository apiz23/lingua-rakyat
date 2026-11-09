# UI-01C evidence report

Status: implementation and source review completed; overall initiative remains open. Authenticated data and mutation QA remain unverified. No commit or push.

## Repository

Canonical repository verified. Branch reconstruction/lingua-rakyat-architecture-2026-11-03; HEAD 86af77cd13b34e817547925f72284558c19198df. Starting status: 30 entries, all existing backend/database/.gitignore work preserved. Earlier 4c1e0a4 was stale.

## Route matrix

Classification is initial source-review classification; COMPLETE means acceptable implementation structure, not a claim of authenticated browser coverage. Fixed routes have the described changes; runtime limits below still apply.

| Route | Initial | Review/change |
|---|---|---|
| / | DEFECT | Public privileged navigation removed; hero retained |
| /about | DEFECT | Mobile table overflow fixed; focusable scroll region |
| /results | DEFECT | Public actions and metrics error/retry fixed |
| /share/[slug] | DEFECT | H1, natural scrolling, wrapping and persistent PDF error |
| /sign-in | COMPLETE | Existing shared shell, pending controls and inline errors; unchanged |
| /sign-up | COMPLETE | Existing shared shell, pending controls and inline errors; unchanged |
| /sso-callback | MINOR | Loading status announcement; callback logic unchanged |
| /workspace | COMPLETE | Existing error/retry and bounded chat layout; page unchanged |
| /profile | DEFECT | Loading failure recovery, retry, revoke failure feedback and wrapping |
| /shares | DEFECT | Awaited clipboard feedback and protected revoke busy/failure state |
| /manage | COMPLETE | Real metrics, refresh/retry and empty activity; unchanged |
| /manage/documents | COMPLETE | Named filters, table container and paging; unchanged |
| /manage/documents/[id] | DEFECT | Current revision no longer always labeled published |
| /manage/ingestion | COMPLETE | Discovery/candidates/jobs, errors, retry/cancel and private review handoff; unchanged |
| /manage/sources | MINOR | Source search named |
| /manage/review | DEFECT | Approval confirmation clearly says it does not publish |
| /manage/publications | DEFECT | Query-state initialization and real API pagination |
| /manage/audit | COMPLETE | Named filters, details disclosure and paging; unchanged |
| /manage/users | COMPLETE | Labeled grant/revoke flows and feedback; unchanged |
| /manage/status | COMPLETE | Actual checks, timestamp, refresh and error recovery; unchanged |
| /eval | DEFECT | Section selectors use truthful pressed-button semantics and focus rings |
| /benchmark | MINOR | Header wraps at narrow widths |

## Responsive evidence

All 22 requested routes visited at 375, 430, 768, 1024 and 1440px: 110 DOM measurements; no navigation timeout and no document scrollWidth greater than viewport width. This checks page containment, not every component state.

| Requested route | Rendered route/state | 375 | 430 | 768 | 1024 | 1440 |
|---|---|---|---|---|---|---|
| / | / | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /about | /about | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /results | /results | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /share/ui01c-missing | /share/ui01c-missing | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /sign-in | /sign-in | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /sign-up | /sign-up | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /sso-callback | /sign-in | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /workspace | /workspace | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /profile | /sign-in | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /shares | /shares | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /eval | /eval | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /benchmark | /benchmark | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/documents | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/documents/ui01c-missing | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/ingestion | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/sources | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/review | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/publications | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/audit | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/users | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |
| /manage/status | /sign-in (signed-out boundary only) | No page overflow | No page overflow | No page overflow | No page overflow | No page overflow |

Protected /manage routes and /profile rendered sign-in; SSO without provider callback also returned to sign-in. Shared slug was deliberately nonexistent: only not-found state verified. Valid share content, signed-in profile/admin layouts, populated tables, long live records and admin dialog states were not browser verified. No credentials requested and no mutations performed.

## Browser investigation

Existing Node process 31896 owned port 3000 with Next dev parent 13616. Root HTTP HEAD returned 200. No unrelated process stopped or cache deleted. Used PLAYWRIGHT_PORT=3000 to reuse existing server rather than starting competing Next instances. Preview opened successfully but snapshots twice timed out (15000ms), and resize responses initially contained prior viewport sizes; those unreliable samples were discarded. Switched to direct Playwright. Browser binaries initially missing; playwright install chromium completed. Serial Chromium smoke run: 3 passed, 3 failed.

Failures: (1) share fixture uses page.route but getShare executes server-side, so mock never intercepts and page shows missing share; (2) sign-up test expects Sign up wording while page says Create account; (3) old admin test expects signed-out administration navigation, but existing server layout correctly redirects. Existing tests/assertions preserved. Initial parallel run also had page-load timeouts. Current responsive scan reached all routes without ECONNRESET. Concurrency/cache pressure is a plausible contributor, not a proven root cause of historical failures.

## Validation

Integrated TypeScript exit 0. Unit tests: 3 files, 27 tests passed. Changed-file ESLint: 0 errors, 6 existing research warnings (unused fixtures/import, hook dependency and expression). Production build passed, all existing routes preserved. Whitespace check passed. Later sidebar/not-found changes rechecked separately.

## Accessibility and states

Public/header/footer/404 privileged destinations removed. About table focusable and constrained. Source search labeled. Share question H1 and long text readable. Loading callback announces status. Citizen active links use aria-current. Research section buttons expose aria-pressed without incomplete tab semantics. Action dialog prevents dismiss/edit while pending and associates required reason help. Current revision status now derives from actual publication status.

## Exact source files changed

- frontend/app/(admin)/manage/documents/[id]/page.tsx
- frontend/app/(admin)/manage/publications/page.tsx
- frontend/app/(admin)/manage/review/page.tsx
- frontend/app/(admin)/manage/sources/page.tsx
- frontend/app/(auth)/sso-callback/page.tsx
- frontend/app/(citizen)/profile/page.tsx
- frontend/app/(citizen)/shares/page.tsx
- frontend/app/(public)/about/page.tsx
- frontend/app/(public)/results/page.tsx
- frontend/app/(public)/share/[slug]/page.tsx
- frontend/app/(public)/share/[slug]/share-sources.tsx
- frontend/app/(research)/benchmark/page.tsx
- frontend/app/(research)/eval/page.tsx
- frontend/app/not-found.tsx
- frontend/components/admin/action-dialog.tsx
- frontend/components/app-sidebar.tsx
- frontend/components/experience-nav.tsx
- frontend/components/footer.tsx
- frontend/components/ui/sidebar.tsx

Additional QA artifacts: qa/ui01c-responsive.mjs, qa/ui01c-responsive.json, qa/ui01c-interactions.mjs, qa/ui01c-interactions.json and screenshots/*.png.

## Screenshots

After screenshots for home/about/results/sign-in/workspace at 375 and 1440 are in qa/screenshots. About 375 visually inspected; screenshot shows contained content and wrapped navigation. Other screenshots are captured evidence, not exhaustive visual sign-off. No before screenshots captured; initial About overflow measured 656px at 430px viewport, later 430px after fix.

## Manual verification still required

1. Sign in with an existing authorized account. At all five widths inspect each admin route, sidebar collapse/mobile close, long titles and table scrolling.
2. On a non-production test document verify filters/paging, metadata validation, review reason requirement, approve vs publish distinction, revision promotion/rollback confirmations and success/failure feedback. Do not perform production mutations.
3. Exercise populated profile/shares, clipboard denial, revoke failure/retry, valid share source/PDF opening and close.
4. Test OAuth completion, callback failure, keyboard focus order and Escape in every dialog, light/dark and reduced motion.
5. Verify research requests/streaming against authorized backend and actual empty/error states.

Remaining: authenticated screenshots/interactions, valid shared content, full contrast audit and assistive-technology review. Do not mark overall UI-01 complete solely from build or containment checks.

## Focused interaction results

Latest stored run: 3 passed (About section navigation, keyboard focus visible from a known link, admin signed-out redirect), 2 failed (mobile sidebar Escape did not dismiss within 5 seconds, research section selector did not reach expected pressed state within 30 seconds). Added visible mobile close button and explicit Escape state reset, but post-final-listener runtime verification remains outstanding. Research failure may include selector/render timing and remains unresolved. These are open QA defects; UI-01C is NOT marked COMPLETE. See ui01c-interactions.json for exact errors.

## Final Git snapshot

HEAD unchanged at 86af77cd13b34e817547925f72284558c19198df. 50 status entries: preserved 30 initial entries, 19 modified frontend source files, one untracked QA directory. Tracked frontend diff: 117 insertions, 107 deletions across 19 files. No staged changes, commit, push, merge, deployment, backend change or production mutation. QA scripts and screenshots are local untracked artifacts.
