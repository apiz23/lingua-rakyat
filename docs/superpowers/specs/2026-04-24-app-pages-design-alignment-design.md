# App Pages Design Alignment — Design Spec

**Date:** 2026-04-24  
**Scope:** `/app/(app)` pages — results, benchmark, eval, manage  
**Reference:** `frontend/app/page.tsx` (root landing page)  
**Approach:** Surgical card + typography pass (no structural rewrites, no animations)

---

## Design Principles (from root page.tsx)

| Token | Value |
|-------|-------|
| Card surface | `border border-border bg-card/40 backdrop-blur-sm` |
| Card hover | `hover:border-primary/30 hover:bg-card/60 hover:shadow-lg` |
| Border radius | **None** — all cards sharp (no `rounded-*`) |
| Section divider | `h-px w-full bg-border` (static version of AnimatedRule) |
| Section label | `text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase` |
| Container | `mx-auto max-w-7xl px-6 lg:px-10` |
| Layout | Left-aligned, document-first |
| Animations | None in app pages (static only) |
| Emoji as icons | Forbidden — use Lucide icons or text badges |
| Status pill badges | `rounded-full` allowed for small inline status pills only |

---

## Fix Order

1. `results/page.tsx` — worst offender
2. `benchmark/page.tsx`
3. `eval/page.tsx`
4. `manage/page.tsx`

---

## 1. results/page.tsx

### Container
- Replace `container mx-auto max-w-6xl px-4` → `mx-auto max-w-7xl px-6 py-10 lg:px-10`
- No `border-x` — app pages live inside `AppShell`/`SidebarInset`, sidebar layout makes border-x inappropriate

### Header section
- Remove `flex flex-col items-center text-center`
- Remove shadcn `Badge` hero → replace with section label: `text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase`
- `h1` left-aligned, remove centering
- `p` description left-aligned, remove `text-xl` → `text-lg leading-relaxed text-muted-foreground`

### Quick Links grid
- Remove all `Card/CardHeader/CardContent/CardTitle/CardDescription` imports and usage
- Replace with raw `div` → `border border-border bg-card/40 backdrop-blur-sm p-6` (no rounded)
- Card title: `font-heading text-lg font-semibold text-foreground`
- Card description: `text-sm text-muted-foreground mt-1`
- Card CTA button: keep shadcn `Button` (already styled correctly)
- Active card (workspace): `border-primary/20 bg-primary/5` instead of `border-primary/20 bg-primary/5` Card

### Section dividers
- Add `<div className="h-px w-full bg-border my-8" />` between each major section

### Section headings (h2)
- Add `text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase mb-2` label above each `h2`
- `h2` itself: `font-heading text-2xl font-semibold text-foreground`

### MetricCard
- Remove shadcn `Card` wrapper → `div` with `border border-border bg-card/40 backdrop-blur-sm p-5` (no rounded)
- Keep internal layout unchanged

### Feature Checklist Card
- Remove shadcn `Card/CardContent` → `div` with `border border-border bg-card/40`
- `ComplianceRow` dividers already use `divide-y` — keep

### SDG Impact Card
- Remove `Card` with `border-primary/20 bg-primary/5` → `div border border-primary/20 bg-primary/5 p-6` (no rounded)
- Stats inside: left-align instead of `text-center` where appropriate, keep grid

---

## 2. benchmark/page.tsx

### All card containers
- `rounded-3xl` → remove
- `rounded-2xl` → remove  
- `shadow-sm` on `bg-card` → remove shadow, change to `bg-card/40 backdrop-blur-sm`
- `border border-border/60` → `border border-border`

### MetricCard component
- `rounded-2xl border border-border/60 bg-card` → `border border-border bg-card/40 backdrop-blur-sm` (no rounded)
- Icon wrapper `rounded-xl bg-primary/10 p-2` → remove rounded, keep bg + padding

### Duplicate header in PageIntro
- Remove the entire `<div className="mx-auto flex max-w-7xl...">` children block inside `PageIntro`
- `PageIntro` already renders title/description/icon/actions — children block is redundant

### Hardcoded Malay metric labels
- Move `label` and `sub` strings for MetricCards into the `copy` object (already has `language` toggle)
- Add English equivalents: "Benchmark Score", "Answer quality match vs benchmark", etc.

### Run section card
- `rounded-3xl border border-border/60 bg-card p-6 shadow-sm` → `border border-border bg-card/40 backdrop-blur-sm p-6`

### Progress bar container
- `rounded-2xl border border-primary/20 bg-primary/5 p-4` → `border border-primary/20 bg-primary/5 p-4` (no rounded)

### Scorecard and Live Report blocks (right column)
- Remove `rounded-3xl` → sharp
- `rounded-2xl bg-muted/20 p-4` description blocks → `bg-muted/20 p-4` (no rounded)
- Row items `rounded-xl bg-muted/20` → `bg-muted/20` (no rounded)

### Per-case result cards
- `rounded-2xl border border-border/60 bg-background p-4` → `border border-border bg-card/40 p-4`
- Inner metric cells `rounded-xl bg-muted/30` → `bg-muted/30` (no rounded)

---

## 3. eval/page.tsx

### Emoji removal
- `LANG_LABELS` — remove `flag` field entirely. Display: text badge `<span className="text-xs font-mono bg-muted px-1.5 py-0.5 text-muted-foreground">EN</span>` + full `name`
- `CATEGORY_LABELS` — remove `emoji` field. Map category keys to Lucide icons:
  - `all` → `LayoutList`
  - `housing` → `Home`
  - `healthcare` → `Heart`
  - `student_loans` → `GraduationCap`
  - `social_welfare` → `Users`
  - `immigration` → `Plane`
- Inline streaming results `LANG` and `CAT` emoji maps → replace with 2-letter text code badge

### All rounded corners
- `rounded-xl` → remove
- `rounded-lg` → remove
- `rounded-md` → remove
- `rounded-full` → keep only on small inline status pill badges

### Card surfaces
- `bg-card` → `bg-card/40 backdrop-blur-sm`

### Duplicate PageIntro header
- Remove the `<div className="mx-auto flex max-w-7xl...">` children block inside `PageIntro`

### RateLimitBanner
- Replace hardcoded blue classes → semantic tokens:
  - `border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200` → `border-border bg-muted/30 text-muted-foreground`

### Section headers
- Add `text-xs font-semibold tracking-[0.22em] uppercase text-muted-foreground` label above each `<h2>` section

### Score bars
- `rounded-full` on progress bars — keep (pill shape on progress bars is standard, not a card)

### Simplification demo split panels
- `rounded-lg border border-border` wrapper → `border border-border` (no rounded)

### Augment result items
- `rounded-lg border border-border bg-muted/20 p-3` → `border border-border bg-muted/20 p-3`

---

## 4. manage/page.tsx

### StatCard
- `rounded-xl border border-border bg-card` → `border border-border bg-card/40 backdrop-blur-sm`
- Icon container `rounded-lg bg-primary/5` → remove rounded, keep bg

### Document table container
- `rounded-xl border border-border bg-card` → `border border-border bg-card/40`
- Table footer: inherits, no change needed

### Empty state
- `rounded-xl border-2 border-dashed border-border` → `border-2 border-dashed border-border` (no rounded)

### Loading state
- `rounded-xl border border-border` → `border border-border`

### ConfirmDialog modal
- `rounded-xl border border-border bg-card` → `border border-border bg-card`
- Icon wrapper `rounded-full p-2.5` → `p-2.5` (square, no rounded)

### Buttons and inputs
- Upload button `rounded-lg` → remove rounded
- Search input `rounded-lg` → remove rounded
- Bulk delete button `rounded-lg` → remove rounded
- Refresh/cancel buttons → remove rounded

### Section label
- Add `text-xs font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3` above document library section heading

### Status pills (inline badges)
- Keep `rounded-full` — these are small inline status indicators, consistent with root page strip items

---

## What Does NOT Change

- Page logic, state, API calls — untouched
- `workspace/page.tsx` — not in scope (least divergent)
- shadcn `Button` component — already correctly styled
- `PageIntro` component — keep as-is
- `ScrollArea`, `Popover`, `Badge` shadcn components — keep where used for functionality
- `rounded-full` on progress bars and small inline status pills — intentionally kept

---

## Files Changed

- `frontend/app/(app)/results/page.tsx`
- `frontend/app/(app)/benchmark/page.tsx`
- `frontend/app/(app)/eval/page.tsx`
- `frontend/app/(app)/manage/page.tsx`
