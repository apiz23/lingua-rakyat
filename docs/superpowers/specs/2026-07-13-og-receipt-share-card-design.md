# OG Evidence-Receipt Share Card — Design

**Date:** 2026-07-13
**Status:** Approved for planning

## Goal

Make shared answer links (`/share/[slug]`) render a rich, credible preview on
WhatsApp, Twitter/X, and Telegram: an "evidence receipt" OG image showing the
question, a short answer excerpt, the source document, and a confidence chip —
mirroring the in-app receipt introduced on 2026-07-13.

## Background / Current State

- Share infra exists and works: `POST /api/share` stores
  `{question, answer, sources: list[dict], language}` and returns a slug;
  `/share/[slug]` (Next.js) has full `generateMetadata` (OG + Twitter
  `summary_large_image`) and a dynamic 1200×630 OG image.
- `metadataBase` is `https://lingua-rakyat.my` and the domain is live —
  absolute OG URLs already resolve.
- The current OG image shows the question only, on a flat green background,
  system sans font.
- `sources[0]` already carries `doc_name`, `page_start`, `score` — the stored
  payload lacks only `confidence` (float), `confidence_label`, and `agency`.

## Design

### 1. Extend share payload

**Backend (`backend/routers/share.py`, `backend/utils/shared_answers.py`):**

- `ShareRequest` gains optional fields (defaults preserve old clients):
  `confidence: float = 0.0`, `confidence_label: str = ""`, `agency: str = ""`.
- `store_share(...)` passes them through into the stored record.
- `SharedAnswerResponse` returns them with the same defaults so old rows
  (which lack the keys) still deserialize.

**Frontend share button (`message-cards.tsx` share handler + `lib/api.ts`
`createShare`/`SharedAnswer` types):**

- Send `confidence: message.confidence`,
  `confidence_label: message.confidence_label ?? ""`.
- `agency`: the workspace knows the selected document's `agency` (documents
  API returns it); thread it into the share call. If unavailable at the call
  site, send `""` — the card omits the badge.

### 2. OG image redesign (`frontend/app/share/[slug]/opengraph-image.tsx`)

1200×630 receipt layout; all data from `getShare(slug)`:

- **Top row:** `LINGUA RAKYAT` wordmark (left) + agency badge pill (right,
  e.g. `PTPTN`) — badge omitted when `agency` is empty.
- **Middle:** small uppercase question label (muted light-green), question
  text (1–2 lines, ~90 chars), then answer excerpt — plain-text-stripped
  (reuse the page's `plainExcerpt` logic), ~200 chars, 2–3 lines, the visual
  center of the card.
- **Bottom row:** doc pill `«doc_name» · p.{page_start}` (from `sources[0]`,
  omitted if no sources) + confidence chip + domain `lingua-rakyat.my`.
- **Confidence chip:** colored by `confidence_label` — high: light green on
  dark green; medium: neutral warm paper; low: amber. Label text localized by
  `language`: en "High match / Medium match / Low match — verify", ms
  "Padanan tinggi / sederhana / rendah — sila sahkan", zh "匹配度高 / 中 /
  低 — 请核实". Chip omitted when `confidence_label` is empty (old rows).
- **Typography:** Bricolage Grotesque Bold (700) for question + wordmark,
  loaded into `ImageResponse` via `fetch` of a bundled `.ttf` under
  `frontend/assets/` (checked into repo; no runtime Google Fonts dependency).
  Answer/body text uses default sans. If the font fetch fails, render with
  system sans rather than erroring.
- **Palette:** civic green `#14532d` background retained; warm paper
  `#f5f3ec` text panel accents; amber `#d97706` only for the low chip.

### 3. Page metadata polish (`frontend/app/share/[slug]/page.tsx`)

- `openGraph.locale`: `ms_MY` when language starts with `ms`, `zh_CN` when
  `zh`, else `en_US`.
- `description`: answer excerpt (as today), with ` — {doc_name}` appended when
  `sources[0].doc_name` exists (WhatsApp shows description under the image).
- Everything else (title template, `summary_large_image`) unchanged.

## Error Handling

- Old share rows (no `confidence_label`/`agency`): card renders without badge
  and chip; doc pill renders only if sources exist — degraded layout must
  still be balanced (question + answer + wordmark).
- `getShare` returns null (bad slug): keep current fallback — generic
  "Shared answer" card, page 404s as today.
- Font file missing/unreadable: log and fall back to system sans; never fail
  the image response.

## Testing

- Backend: extend the share roundtrip — `POST /api/share` with new fields,
  `GET /api/share/{slug}` asserts they persist; a second test posts WITHOUT
  the new fields and asserts defaults come back (old-client compatibility).
- Frontend: `pnpm build`; manual render check at
  `http://localhost:3000/share/<slug>/opengraph-image` for three states:
  full data (high), low-confidence, and legacy row (no new fields).
- Post-deploy: Twitter Card Validator + send link to self on WhatsApp.

## Out of Scope

- Sign-in / accounts / "my shares" list (separate sub-project, next).
- Share analytics, short-domain URLs, image caching tweaks.
- Redesign of the share page body itself (HTML page stays as-is).
