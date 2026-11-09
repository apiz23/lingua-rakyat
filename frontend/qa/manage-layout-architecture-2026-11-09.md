# Manage layout architecture — 2026-11-09

This supersedes the custom dialog size API, inline width calculations, and admin
CSS layout described in earlier responsive reports.

## Structure

- `(admin)/layout.tsx` remains the route-group boundary. It no longer imports the
  legacy `admin.css`; that existing file was retained to preserve earlier work.
- `manage/layout.tsx` retains the existing server-side Clerk authentication check
  and renders `AdminShell`. Its changes in this pass are formatting only.
- `AdminShell` composes shadcn `SidebarProvider`, `Sidebar`, `SidebarInset`, and
  `SidebarTrigger`. Main content uses a centered `max-w-7xl` Tailwind container.
- Pages use responsive Tailwind grids, wrapping action groups, UI fields and
  controls, and shared `Card`, `Table`, and `Badge` components.
- Operational metrics compose `CardHeader`, `CardDescription`, and `CardContent`.
  The dashboard uses one, two, or four columns according to viewport width.

Removed runtime uses of the bespoke `admin-ledger`, `admin-record`,
`admin-filterbar`, `admin-surface`, `admin-table`, and typography layout classes.
Existing URLs, data loading, forms, actions, and authorization are preserved.

## Dialogs

`components/ui/dialog.tsx` uses the ordinary shadcn composition of Radix
`Dialog`, `DialogPortal`, overlay, content, header, footer, title, and description.
There is no custom `size` property or inline sizing. Default content is
`w-full max-w-[calc(100%-2rem)] sm:max-w-lg` with bounded height and scrolling.
Grant-role and shared administrative confirmation dialogs use
`className="sm:max-w-md"`. Source and upload forms use the default.

Global CSS no longer targets `[role="dialog"]`. The remaining native `<dialog>`
fallback does not match Radix's div-based content or sidebar sheets.

## Source delivery problem

During verification, the development server continued delivering an older
stylesheet across restarts. The source contained only the native-dialog rule,
while the actual served CSS still contained the previous role selector.
Disabled Next 16's supported `experimental.turbopackFileSystemCacheForDev` option.
After its automatic restart, the browser received the current native-only rule.
Production build caching, Clerk, middleware, and API authorization were unchanged.

## Verification

- TypeScript: passed.
- ESLint across manage pages, route-group layout, admin components, shared dialog,
  and Next configuration: passed.
- Frontend unit tests: 5 files, 70 tests passed.
- Production build: passed using the existing `UI01D_TEST_SERVER=1` output
  isolation, including all route generation. Next's two automatically added
  `.next-ui01d` TypeScript include entries were removed afterward to preserve the
  prior configuration.
- Formatting: Prettier applied to the touched manage and shared admin code.
- Whitespace: `git diff --check` passed with line-ending conversion advisories.

Browser measurements used the development server's actual loaded CSS and the
shared component's source classes, merged through the project's `tailwind-merge`.
The fixtures were isolated from authentication and API operations. No inline width
was applied to the measured dialog elements.

| Viewport | Grant/confirmation width | Source/upload width |
| ---: | ---: | ---: |
| 375px | 343px | 343px |
| 430px | 398px | 398px |
| 768px | 448px | 512px |
| 1024px | 448px | 512px |
| 1440px | 448px | 512px |

Long content remained within the dialog horizontally and scrolled vertically.
At 400px viewport height, tall dialogs were bounded to 368px. Metric grid checks
returned one, one, two, two, and four columns at the five widths, with long names
contained.

These are shared-component layout checks. The authenticated Grant admin role
dialog and populated management workflows were not verified: the preview session
has no authorized login. The earlier full-width claims are not a substitute for
that remaining verification.

## Files changed in this pass

- `frontend/app/(admin)/layout.tsx`
- `frontend/app/(admin)/manage/layout.tsx` (formatting)
- `frontend/app/(admin)/manage/page.tsx`
- `frontend/app/(admin)/manage/audit/page.tsx`
- `frontend/app/(admin)/manage/documents/page.tsx`
- `frontend/app/(admin)/manage/ingestion/page.tsx`
- `frontend/app/(admin)/manage/publications/page.tsx`
- `frontend/app/(admin)/manage/review/page.tsx`
- `frontend/app/(admin)/manage/sources/page.tsx`
- `frontend/app/(admin)/manage/status/page.tsx`
- `frontend/app/(admin)/manage/users/page.tsx`
- `frontend/components/admin/action-dialog.tsx`
- `frontend/components/admin/admin-shell.tsx`
- `frontend/components/admin/metric-card.tsx`
- `frontend/components/ui/dialog.tsx`
- `frontend/app/globals.css`
- `frontend/next.config.mjs`
- This report and the supersession notice in the previous responsive report.

Branch: `reconstruction/lingua-rakyat-architecture-2026-11-03`.
HEAD: `cbe00b38c03b8295d892b401260f601381654ee6`.
Existing unrelated work remains preserved. No commit, push, deployment, backend,
database, or production operation was performed. The frontend remains available
on local port 3000.
