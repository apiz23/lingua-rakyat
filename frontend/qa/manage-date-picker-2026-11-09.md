# Manage date controls and shadcn skill — 2026-11-09

## Skill installation and component discovery

Installed the official `shadcn-ui/ui` skill globally for Codex at
`C:/Users/Hafizuddin/.codex/skills/shadcn`. The skill and its form/Radix rules
were read and applied; automatic discovery is available on the next turn.
Installation used the skill-installer download workflow, without creating a
project clone or worktree.

`shadcn info --json` confirmed Next.js App Router, Tailwind v4, Radix Vega,
Lucide, and the project's existing aliases. Searched the official registry and
consulted the official Calendar, Date Picker, Field, Input Group, Select, and
Popover documentation. Date Picker is an official composition recipe rather
than an independently installable registry root component.

Added Calendar through the shadcn CLI. Declined its Button overwrite prompt;
the existing Button source was checked against its pre-install contents and
remained identical. Calendar uses the existing `@/lib/utils` helper. The only
new dependencies are `react-day-picker` and `date-fns`.

## Implementation

- Added `components/ui/calendar.tsx` from the configured Radix Vega registry.
- Added `components/ui/date-picker.tsx`, composing Button, Popover, and Calendar.
  It supports controlled date-only strings, month/year dropdowns, minimum/maximum
  dates, explicit clearing, English/Malay copy and date formatting, disabled and
  validation attributes, and bounded popup dimensions.
- Replaced all three native date inputs in manage: Uploaded from, Uploaded to,
  and document expiry. Existing filter boundary conversion remains unchanged.
- Clearing document expiry sends the backend-supported `expires_at: null`.
  Previously an empty expiry sent `undefined`, which omitted the update.
- Extended the existing Field component module with FieldGroup and applied it to
  document filters, metadata, upload, source, role, and reason forms.
- Used the existing InputGroup for catalogue/candidate searches and SelectGroup
  for management dropdown options. No new form library or component preset.
- Added strict local date-only parsing/formatting and nine regression tests,
  including leap days, invalid dates, and Malaysian timezone preservation.

Official recipe: https://ui.shadcn.com/docs/components/radix/date-picker

## Verification

- TypeScript: passed.
- ESLint on changed manage/UI/date utility files: passed.
- Unit tests: 6 files, 79 passed (70 existing and 9 date-only tests).
- Localization: passed; 2499 catalog keys and 780 literal UI keys checked.
- No native date/datetime inputs remain in manage.
- Whitespace: passed, with existing Git line-ending advisories.
- Production build: passed on retry, including TypeScript and all route generation,
  using the existing `UI01D_TEST_SERVER=1` output isolation. The first attempt
  encountered a transient root Google Font resolver failure for JetBrains Mono
  (`next/font/google queries have exactly one entry`). No font or compiler
  configuration was changed. Removed Next's two generated `.next-ui01d` TypeScript
  include additions afterward to preserve the prior configuration.

### Real component browser checks

Mounted the actual DatePicker, Calendar, Radix Popover, Button, and Field
components in an isolated iframe using the application's loaded CSS. Only the
English localization context was stubbed; no authentication or API behavior was
mocked or bypassed. The fixture used disposable state and made no mutations.
Its temporary bundle was removed after verification.

Verified using browser pointer/keyboard actions:

- Opening focuses the selected calendar day.
- ArrowRight moves November 9 to November 10; Enter selects it.
- Controlled output becomes exactly `2026-11-10` and the popup closes.
- Escape closes the popup and returns focus to the trigger.
- Clear date empties the controlled value, closes the popup, and returns focus.
- Dates before November 8 and after November 12 are disabled in the bounded fixture.
- Calendar actions do not accidentally submit the surrounding form.
- No component runtime errors or unhandled rejections.

At 375, 430, 768, 1024, and 1440px iframe viewport widths the real popup measured
252px, fit within viewport margins, and caused no page horizontal overflow.
Dark theme used the existing dark semantic background tokens.

The preview accessibility snapshot timed out, so direct pointer coordinates were
derived from measured element rectangles. Keyboard actions were actual browser
keypresses. This is component interaction verification; authenticated admin
pages and backend metadata submission remain unverified without an authorized
session.

## Files changed in this pass

- `frontend/components/ui/calendar.tsx` (new)
- `frontend/components/ui/date-picker.tsx` (new)
- `frontend/components/ui/field.tsx`
- `frontend/components/admin/action-dialog.tsx`
- `frontend/app/(admin)/manage/documents/page.tsx`
- `frontend/app/(admin)/manage/documents/[id]/page.tsx`
- `frontend/app/(admin)/manage/ingestion/page.tsx`
- `frontend/app/(admin)/manage/sources/page.tsx`
- `frontend/app/(admin)/manage/users/page.tsx`
- `frontend/lib/date-only.ts` (new)
- `frontend/lib/date-only.test.ts` (new)
- `frontend/lib/i18n/en.json`
- `frontend/lib/i18n/ms.json`
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- This report and the build log referenced below.

Build retry log: `frontend/qa/manage-date-picker-build-20261109.log`.

Branch: `reconstruction/lingua-rakyat-architecture-2026-11-03`.
HEAD: `cbe00b38c03b8295d892b401260f601381654ee6`.
Existing work was preserved. No commit, push, deployment, backend edit, database,
role change, or production operation was performed.
