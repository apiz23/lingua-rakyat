# Manage responsive remediation — 2026-11-09

Superseded by [Manage layout architecture](manage-layout-architecture-2026-11-09.md).
The custom size API, inline widths, and admin CSS layouts described below have
since been replaced with shadcn composition and Tailwind classes.

## Root cause

The global rule `:where(dialog, [role="dialog"])` was outside all CSS layers.
Its viewport-sized `max-width` took precedence over Tailwind's layered
`max-w-xs`, `max-w-sm`, and `max-w-lg` utilities, regardless of selector specificity.
Changing individual dialog classes therefore did not reliably constrain laptop dialogs.

Moved that fallback into `@layer base`. Dialog utilities now take precedence.
The shared `DialogContent` owns safe viewport dimensions, scrolling, long-text
wrapping, and an explicit `size` option. Admin confirmation and grant-role
dialogs use `sm`; upload and source forms use `lg`.

## Route and component review

| Route | Review and remediation |
| --- | --- |
| `/manage` | Reviewed metric cells and activity list; inherits header, status-badge, and long-content containment improvements. No independent page change needed. |
| `/manage/documents` | Upload uses shared large dialog; table retains internal horizontal scrolling; pagination wraps instead of squeezing controls. |
| `/manage/documents/[id]` | Reviewed metadata, processing, revision history, and action dialogs. Shared compact dialogs and wrapping badges apply without duplicating page fixes. |
| `/manage/ingestion` | Compact action dialogs; discovery titles wrap; long source URLs remain readable; filters use two columns before the larger-screen three-column layout. |
| `/manage/sources` | Registration, verification, and editing use shared large dialogs; verification textarea has a bounded height. Existing responsive source cards retained. |
| `/manage/review` | Compact shared decision dialog; title/content and actions can wrap independently. |
| `/manage/publications` | Long titles and metadata take available space while inspection actions wrap. Existing filter and pagination wrapping retained. |
| `/manage/audit` | Reviewed filters, event disclosures, and pagination; shared table container constrains wide content. No separate page change needed. |
| `/manage/users` | Grant-role and revoke dialogs use shared compact sizing; role table stays inside its scroll container. |
| `/manage/status` | Reviewed operational cells; shared status labels and long-content handling wrap. No separate page change needed. |

Reviewed all five components in `components/admin`: shell, action dialog, state
views, status badge, and metric cell. Metric-cell structure remains appropriate.
The sidebar's mobile sheet now explicitly allows full viewport height, overriding
the generic dialog fallback. Account controls do not shrink into breadcrumbs.
Shared select triggers can shrink within narrow filter columns. Dropdown content
is bounded by the viewport, and long source names wrap in the option list.
Dropdown interaction and positioning remain unverified in authenticated pages.

## Browser evidence

This is component layout verification, not authenticated application verification.
The local app navigation encountered the existing Next.js proxy `ECONNRESET` /
`socket hang up` failure. No authentication, middleware, or credentials were changed.

Compiled the real `globals.css` with the installed Tailwind PostCSS plugin and
included the real `admin.css`. Dialog classes were read from `DialogContent`
source. Loaded these into isolated browser iframe viewports and measured actual
element rectangles and scroll dimensions. The preview host did not apply requested
resizes, so iframe viewport widths were explicitly checked against `innerWidth`.
Fixtures contained disposable long filenames and tall content only.

Reintroduced the original unlayered rule temporarily inside the fixture to
reproduce the failure, then removed it to measure the corrected behavior:

| Viewport | Compact width with old global rule | Corrected compact width | Corrected upload/source width |
| ---: | ---: | ---: | ---: |
| 375px | 343px | 320px | 343px |
| 430px | 398px | 320px | 398px |
| 768px | 736px | 384px | 512px |
| 1024px | 992px | 384px | 512px |
| 1440px | 1408px | 384px | 512px |

All tested dialogs stayed within the viewport with at least 16px outer margins,
had no horizontal content overflow, and scrolled vertically when content exceeded
available height. At 400px viewport height, tall dialogs were bounded to 368px.
The sidebar fixture retained its full 800px / 400px viewport height.

The shared table fixture contained its 900px table within available widths of
343px, 398px, 448px, and 704px, with horizontal scrolling inside the table container.
At the 1440px viewport its 1120px container needed no horizontal scrolling.

Authenticated route rendering, real populated records, and workflow interactions
remain unverified. No full authenticated visual QA pass is claimed.

## Validation

- `pnpm typecheck`: passed.
- ESLint across every manage page, every admin component, and shared dialog/table/sidebar/select: passed.
- `pnpm test:unit`: 5 files and 70 tests passed; existing Node deprecation warning only.
- Tailwind/PostCSS compilation: passed.
- Browser layout fixtures: passed at all five widths and both short-height cases.
- `git diff --check`: passed; Git reported line-ending conversion warnings.
- `pnpm build`: passed, including TypeScript and generation of all 25 static-page entries.

## Files changed in this pass

- `frontend/app/globals.css`
- `frontend/app/admin.css`
- `frontend/app/(admin)/manage/documents/page.tsx`
- `frontend/app/(admin)/manage/ingestion/page.tsx`
- `frontend/app/(admin)/manage/publications/page.tsx`
- `frontend/app/(admin)/manage/review/page.tsx`
- `frontend/app/(admin)/manage/sources/page.tsx`
- `frontend/app/(admin)/manage/users/page.tsx`
- `frontend/components/admin/action-dialog.tsx`
- `frontend/components/admin/admin-shell.tsx`
- `frontend/components/admin/admin-state.tsx`
- `frontend/components/admin/status-badge.tsx`
- `frontend/components/ui/dialog.tsx`
- `frontend/components/ui/sidebar.tsx`
- `frontend/components/ui/select.tsx`
- `frontend/components/ui/table.tsx`
- `frontend/qa/manage-responsive-2026-11-09.md`

Branch: `reconstruction/lingua-rakyat-architecture-2026-11-03`.
HEAD: `cbe00b38c03b8295d892b401260f601381654ee6`.
Existing dirty and untracked work was preserved. No staging, commit, push,
deployment, backend change, or database operation was performed.

## Follow-up: live server stylesheet and development updates

The running development server was still delivering a stylesheet containing the
old unlayered dialog rule. Using that actual stylesheet reproduced a 1248px-wide
dialog at a 1280px viewport, despite the corrected source and earlier isolated
PostCSS checks.

`DialogContent` now sets its width explicitly to `min(size, viewport minus 2rem)`;
the small/normal/large sizes are 24/28/32rem. Existing responsive maximum-width
classes still provide the smaller 320px mobile cap for compact dialogs. The
generic fallback selector excludes shared primitives identified by `data-slot`.
An older broad maximum-width rule therefore cannot expand the component to fill
the screen. Every manage dialog uses this component directly or through
`ActionDialog`.

The server also logged blocked development requests from `127.0.0.1`. Inspection
of the installed Next.js `block-cross-site` implementation showed that
`allowedDevOrigins` compares hostnames, while the existing LAN entries were full
URLs. Updated `next.config.mjs` to allow the exact intended local hostnames:
`localhost`, `127.0.0.1`, `192.168.0.108`, and `192.168.1.14`. All four pass Next's
installed origin-matching function. Clerk, middleware, roles, and API boundaries
were not changed.

Restarted only the verified canonical project's local frontend processes. The
development server now serves the corrected base-layer selector. It remains
running on port 3000. Using its actual loaded CSS, browser iframe measurements at
375, 430, 768, 1024, 1280, and 1440px reproduced the corrected widths in the table
above (384px compact and 512px large at the additional 1280px viewport). Long
content had no horizontal overflow and scrolled vertically.

These remain shared-component layout checks. The preview session was redirected
from `/manage/users` to sign-in, so authenticated form interaction is not claimed.
Follow-up ESLint, TypeScript, and whitespace checks passed. The production build
listed above belongs to the preceding pass and was not rerun during this follow-up.

Additional file changed: `frontend/next.config.mjs`.
