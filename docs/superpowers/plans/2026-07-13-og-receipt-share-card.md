# OG Evidence-Receipt Share Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared answer links render a rich "evidence receipt" preview (question, answer excerpt, doc pill, confidence chip, agency badge) on WhatsApp/Twitter/Telegram.

**Architecture:** Three optional fields (`confidence`, `confidence_label`, `agency`) flow share-button → `POST /api/share` → Supabase `lr_shared_answers` → `GET /api/share/{slug}` → the Next.js OG image route. Doc name and page already ride the stored `sources` array. The OG image (`opengraph-image.tsx`) is redesigned as a receipt with a repo-bundled Bricolage Grotesque font; old rows without the new fields degrade to a badge-less, chip-less card.

**Tech Stack:** FastAPI + Supabase (backend), Next.js `ImageResponse` (`next/og`) + `@fontsource/bricolage-grotesque` (frontend), pytest.

**Spec:** `docs/superpowers/specs/2026-07-13-og-receipt-share-card-design.md`

## Global Constraints

- New share fields are optional with defaults: `confidence: float = 0.0`, `confidence_label: str = ""`, `agency: str = ""` — old clients and old rows must keep working.
- OG image: 1200×630, background `#14532d`, warm paper accent `#f5f3ec`, amber `#d97706` only for the low-confidence chip.
- Confidence chip labels localized: en "High match"/"Medium match"/"Low match — verify", ms "Padanan tinggi"/"Padanan sederhana"/"Padanan rendah — sila sahkan", zh "匹配度高"/"匹配度中"/"匹配度低 — 请核实". Chip omitted when `confidence_label` is empty.
- Font is bundled in the repo (no runtime Google Fonts fetch); font load failure must fall back to system sans, never fail the response.
- **Manual migration (user action, before E2E/deploy):** run in Supabase SQL editor:
  `alter table lr_shared_answers add column if not exists confidence numeric not null default 0, add column if not exists confidence_label text not null default '', add column if not exists agency text not null default '';`
- Backend commands: from `backend/` with `.venv/Scripts/python.exe -m pytest`. Frontend: `pnpm` from `frontend/`.

---

### Task 1: Backend — share payload fields

**Files:**
- Modify: `backend/routers/share.py` (whole file is 63 lines)
- Modify: `backend/utils/shared_answers.py:1-59` (docstring + `store_share`)
- Test: `backend/tests/test_share_fields.py` (create)

**Interfaces:**
- Produces: `store_share(question, answer, sources, language, confidence: float = 0.0, confidence_label: str = "", agency: str = "") -> str`; `ShareRequest`/`SharedAnswerResponse` with the three new optional fields (exact names: `confidence`, `confidence_label`, `agency`). Task 2 sends them; Task 3 reads them from `GET /api/share/{slug}` JSON.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_share_fields.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import utils.shared_answers as sa
from routers.share import SharedAnswerResponse


class FakeQuery:
    def __init__(self, store, payload=None):
        self.store = store
        self.payload = payload
        self._slug = None

    def insert(self, payload):
        return FakeQuery(self.store, payload)

    def select(self, *_):
        return self

    def eq(self, _field, slug):
        self._slug = slug
        return self

    def execute(self):
        class Res:
            pass
        res = Res()
        if self.payload is not None:  # insert path
            self.store[self.payload["slug"]] = self.payload
            res.data = [self.payload]
        else:  # select path
            row = self.store.get(self._slug)
            res.data = [row] if row else []
        return res


class FakeSupabase:
    def __init__(self):
        self.store = {}

    def table(self, _name):
        return FakeQuery(self.store)


def _with_fake(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(sa, "get_supabase", lambda: fake)
    return fake


def test_store_share_persists_new_fields(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(
        question="Q", answer="A", sources=[], language="ms",
        confidence=0.82, confidence_label="high", agency="PTPTN",
    )
    row = fake.store[slug]
    assert row["confidence"] == 0.82
    assert row["confidence_label"] == "high"
    assert row["agency"] == "PTPTN"


def test_store_share_defaults_for_old_callers(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(question="Q", answer="A", sources=[], language="en")
    row = fake.store[slug]
    assert row["confidence"] == 0.0
    assert row["confidence_label"] == ""
    assert row["agency"] == ""


def test_get_share_roundtrip(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(
        question="Q", answer="A", sources=[{"doc_name": "KWSP.pdf", "page_start": 3}],
        language="en", confidence=0.4, confidence_label="low", agency="KWSP",
    )
    row = sa.get_share(slug)
    assert row["agency"] == "KWSP"
    assert row["sources"][0]["doc_name"] == "KWSP.pdf"


def test_response_model_defaults_for_old_rows():
    # Rows created before the migration lack the new keys entirely.
    old_row = {
        "slug": "abc", "question": "Q", "answer": "A",
        "sources": [], "language": "ms", "created_at": "2026-01-01T00:00:00Z",
    }
    resp = SharedAnswerResponse(
        slug=old_row["slug"], question=old_row["question"], answer=old_row["answer"],
        sources=old_row.get("sources", []), language=old_row.get("language", "ms"),
        created_at=old_row.get("created_at", ""),
        confidence=old_row.get("confidence", 0.0),
        confidence_label=old_row.get("confidence_label", "") or "",
        agency=old_row.get("agency", "") or "",
    )
    assert resp.confidence == 0.0
    assert resp.confidence_label == ""
    assert resp.agency == ""
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `.venv/Scripts/python.exe -m pytest tests/test_share_fields.py -v`
Expected: FAIL — `store_share() got an unexpected keyword argument 'confidence'` and `SharedAnswerResponse` has no field `confidence`.

- [ ] **Step 3: Implement backend changes**

`backend/utils/shared_answers.py` — extend the docstring's SQL block by appending after the `create table` statement:

```
Migration for the receipt card fields (run once in Supabase SQL editor):

alter table lr_shared_answers
  add column if not exists confidence numeric not null default 0,
  add column if not exists confidence_label text not null default '',
  add column if not exists agency text not null default '';
```

Replace `store_share`:

```python
def store_share(
    question: str,
    answer: str,
    sources: list[dict],
    language: str,
    confidence: float = 0.0,
    confidence_label: str = "",
    agency: str = "",
) -> str:
    slug = secrets.token_urlsafe(12)  # 72-bit entropy — negligible collision risk
    payload = {
        "slug": slug,
        "question": question,
        "answer": answer,
        "sources": sources,
        "language": language,
        "confidence": confidence,
        "confidence_label": confidence_label,
        "agency": agency,
    }
    res = get_supabase().table(TABLE).insert(payload).execute()
    if not res.data:
        raise RuntimeError(f"[Share] Insert returned no data for slug={slug}")
    logger.info("[Share] Stored slug=%s", slug)
    return slug
```

`backend/routers/share.py` — extend the models and both handlers:

```python
class ShareRequest(BaseModel):
    question: str
    answer: str
    sources: list[dict] = []
    language: str = "ms"
    confidence: float = 0.0
    confidence_label: str = ""
    agency: str = ""


class SharedAnswerResponse(BaseModel):
    slug: str
    question: str
    answer: str
    sources: list[dict]
    language: str
    created_at: str
    confidence: float = 0.0
    confidence_label: str = ""
    agency: str = ""
```

In `create_share`, pass the new fields through:

```python
        slug = store_share(
            question=body.question,
            answer=body.answer,
            sources=body.sources,
            language=body.language,
            confidence=body.confidence,
            confidence_label=body.confidence_label,
            agency=body.agency,
        )
```

In `fetch_share`, return them with old-row tolerance (`or` guards cover DB nulls):

```python
    return SharedAnswerResponse(
        slug=result["slug"],
        question=result["question"],
        answer=result["answer"],
        sources=result.get("sources", []),
        language=result.get("language", "ms"),
        created_at=result.get("created_at", ""),
        confidence=float(result.get("confidence", 0.0) or 0.0),
        confidence_label=result.get("confidence_label", "") or "",
        agency=result.get("agency", "") or "",
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_share_fields.py -v`
Expected: 4 PASS.

- [ ] **Step 5: Run full backend suite**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: 79 passed (75 existing + 4 new).

- [ ] **Step 6: Commit**

```bash
git add backend/routers/share.py backend/utils/shared_answers.py backend/tests/test_share_fields.py
git commit -m "feat(share): store confidence and agency on shared answers"
```

---

### Task 2: Frontend — send the new fields from the share button

**Files:**
- Modify: `frontend/lib/api.ts` (`SharedAnswer` interface ~line 839, `createShare` ~line 848)
- Modify: `frontend/components/chat-panel/message-cards.tsx` (`handleShare` ~line 362; `AIMessageCard` props)
- Modify: `frontend/components/chat-panel/index.tsx` (the call site that passes `docId` to the AI message card)

**Interfaces:**
- Consumes: backend fields from Task 1 (`confidence`, `confidence_label`, `agency`).
- Produces: `SharedAnswer` type with `confidence: number`, `confidence_label: string`, `agency: string` — Task 3's OG image reads these from `getShare()`.

- [ ] **Step 1: Extend types and createShare in `frontend/lib/api.ts`**

```ts
export interface SharedAnswer {
  slug: string
  question: string
  answer: string
  sources: SourceChunk[]
  language: string
  created_at: string
  confidence: number
  confidence_label: string
  agency: string
}

export async function createShare(payload: {
  question: string
  answer: string
  sources: SourceChunk[]
  language: string
  confidence?: number
  confidence_label?: string
  agency?: string
}): Promise<ShareResult | null> {
  // body of the function is unchanged — only the payload type widens
```

(Keep the existing function body; only the parameter type and the interface change.)

- [ ] **Step 2: Thread `agency` into the AI message card**

In `message-cards.tsx`, the AI message card component (the one containing `handleShare`) receives props including `docId`. Add an optional prop alongside it, following the existing prop declaration style:

```ts
  agency?: string
```

In `frontend/components/chat-panel/index.tsx`, find where the AI message card is rendered with `docId=` and add:

```tsx
  agency={selectedDoc?.agency ?? ""}
```

- [ ] **Step 3: Send the fields in `handleShare`**

In `message-cards.tsx` (~line 366), extend the `createShare` call:

```ts
        const result = await createShare({
          question: message.question,
          answer: message.answer,
          sources: message.sources,
          language: message.language,
          confidence: message.confidence,
          confidence_label: message.confidence_label ?? "",
          agency: agency ?? "",
        })
```

Add `agency` to the `useCallback` dependency array (alongside the existing deps for this callback).

- [ ] **Step 4: Build**

Run (from `frontend/`): `pnpm build`
Expected: success, no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/components/chat-panel/message-cards.tsx frontend/components/chat-panel/index.tsx
git commit -m "feat(share): send confidence and agency with share requests"
```

---

### Task 3: OG receipt image + page metadata polish

**Files:**
- Create: `frontend/app/share/[slug]/share-text.ts` (shared excerpt helper)
- Create: `frontend/assets/bricolage-700.woff` (copied from @fontsource)
- Rewrite: `frontend/app/share/[slug]/opengraph-image.tsx`
- Modify: `frontend/app/share/[slug]/page.tsx` (use shared helper; `og:locale`; doc name in description)

**Interfaces:**
- Consumes: `SharedAnswer` fields from Task 2 via `getShare(slug)`.
- Produces: `plainExcerpt(markdown: string, maxLength: number): string` exported from `share-text.ts` (used by both `page.tsx` and `opengraph-image.tsx`).

- [ ] **Step 1: Bundle the font**

Run (from `frontend/`):

```bash
pnpm add -D @fontsource/bricolage-grotesque
mkdir -p assets
cp node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff assets/bricolage-700.woff
```

If the package ships no `.woff` (only `.woff2` — check with `ls node_modules/@fontsource/bricolage-grotesque/files/ | grep 700-normal`), `ImageResponse` (satori) cannot use woff2: instead download the static TTF from the Fontsource CDN, which mirrors the same files:
`curl -Lo assets/bricolage-700.woff https://cdn.jsdelivr.net/fontsource/fonts/bricolage-grotesque@latest/latin-700-normal.woff`
Verify the file is non-trivial: `ls -l assets/bricolage-700.woff` (expect > 20 KB).

- [ ] **Step 2: Create the shared excerpt helper**

Create `frontend/app/share/[slug]/share-text.ts` by moving `plainExcerpt` out of `page.tsx` verbatim:

```ts
// Strip markdown syntax so OG descriptions and card text read as plain text.
export function plainExcerpt(markdown: string, maxLength: number): string {
  const text = markdown
    .replace(/[#*_`>[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}
```

In `page.tsx`: delete the local `plainExcerpt` and import it:

```ts
import { plainExcerpt } from "./share-text"
```

- [ ] **Step 3: Rewrite the OG image**

Replace `frontend/app/share/[slug]/opengraph-image.tsx` entirely:

```tsx
import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getShare } from "@/lib/api"
import { plainExcerpt } from "./share-text"

export const alt = "Shared answer from Lingua Rakyat"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const GREEN = "#14532d"
const PAPER = "#f5f3ec"
const MINT = "#bbf7d0"
const AMBER = "#d97706"

const CHIP_LABELS: Record<string, Record<string, string>> = {
  en: { high: "High match", medium: "Medium match", low: "Low match — verify" },
  ms: { high: "Padanan tinggi", medium: "Padanan sederhana", low: "Padanan rendah — sila sahkan" },
  zh: { high: "匹配度高", medium: "匹配度中", low: "匹配度低 — 请核实" },
}

function chipFor(label: string, language: string) {
  if (!label) return null
  const lang = language.startsWith("zh") ? "zh" : language.startsWith("ms") || language.startsWith("id") ? "ms" : "en"
  const text = CHIP_LABELS[lang][label] ?? CHIP_LABELS.en[label]
  if (!text) return null
  // high: mint on deep green; medium: paper on translucent; low: amber
  const style =
    label === "high"
      ? { backgroundColor: "#166534", color: MINT }
      : label === "low"
        ? { backgroundColor: AMBER, color: "#1c1207" }
        : { backgroundColor: "rgba(245,243,236,0.16)", color: PAPER }
  return { text, style }
}

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const data = await readFile(join(process.cwd(), "assets/bricolage-700.woff"))
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  } catch {
    return null // fall back to system sans — never fail the image
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [data, font] = await Promise.all([getShare(slug), loadFont()])

  const question = data ? plainExcerpt(data.question, 90) : "Shared answer"
  const answer = data ? plainExcerpt(data.answer, 200) : ""
  const agency = data?.agency ?? ""
  const chip = data ? chipFor(data.confidence_label ?? "", data.language ?? "en") : null
  const topSource = data?.sources?.[0]
  const docName = topSource?.doc_name ? topSource.doc_name.replace(/\.pdf$/i, "") : ""
  const page = topSource?.page_start

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: GREEN,
          padding: "56px 72px",
          color: "#ffffff",
          fontFamily: font ? "Bricolage" : "sans-serif",
        }}
      >
        {/* Top row: wordmark + agency badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 1, display: "flex" }}>
            Lingua Rakyat
          </div>
          {agency ? (
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                padding: "10px 26px",
                borderRadius: 999,
                backgroundColor: PAPER,
                color: GREEN,
              }}
            >
              {agency}
            </div>
          ) : null}
        </div>

        {/* Middle: question label + question + answer excerpt */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: MINT,
              display: "flex",
            }}
          >
            {question}
          </div>
          <div
            style={{
              fontSize: answer.length > 120 ? 40 : 48,
              fontWeight: 700,
              lineHeight: 1.25,
              color: PAPER,
              display: "flex",
            }}
          >
            {answer || question}
          </div>
        </div>

        {/* Bottom row: doc pill + chip + domain */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {docName ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  padding: "10px 22px",
                  borderRadius: 999,
                  backgroundColor: "rgba(245,243,236,0.14)",
                  color: PAPER,
                }}
              >
                {docName}
                {page ? ` · p.${page}` : ""}
              </div>
            ) : null}
            {chip ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontWeight: 700,
                  padding: "10px 22px",
                  borderRadius: 999,
                  ...chip.style,
                }}
              >
                {chip.text}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: MINT }}>lingua-rakyat.my</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Bricolage", data: font, weight: 700 as const, style: "normal" as const }]
        : undefined,
    }
  )
}
```

Design note: the answer excerpt is the visual center (biggest text); the question rides above it as the small uppercase eyebrow — reversed from the old card, per the approved "evidence receipt" direction.

- [ ] **Step 4: Page metadata polish**

In `frontend/app/share/[slug]/page.tsx` `generateMetadata`, after computing `description`, derive locale and doc name:

```ts
  const docName = data.sources?.[0]?.doc_name?.replace(/\.pdf$/i, "") ?? ""
  const fullDescription = docName ? `${description} — ${docName}` : description
  const locale = data.language?.startsWith("ms")
    ? "ms_MY"
    : data.language?.startsWith("zh")
      ? "zh_CN"
      : "en_US"
```

Use them in the returned object: `description: fullDescription`, and inside `openGraph`: `description: fullDescription, locale,` (title and twitter unchanged except `description: fullDescription`).

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: success. (The `assets/` path is read at request time; build success proves types and imports only.)

- [ ] **Step 6: Manual render check (needs backend running)**

Start backend (`backend/.venv/Scripts/python.exe -m uvicorn main:app --port 8000`) and `pnpm dev`. Create a share via the UI (or `curl -X POST localhost:8000/api/share -H "Content-Type: application/json" -d '{"question":"Berapa fi pasport?","answer":"Fi pasport ialah RM200 untuk 5 tahun.","sources":[{"doc_name":"Passport-FAQ.pdf","page_start":2}],"language":"ms","confidence":0.82,"confidence_label":"high","agency":"JIM"}'`), then open `http://localhost:3000/share/<slug>/opengraph-image` and verify:
- full card: wordmark, JIM badge, question eyebrow, big answer text, doc pill `Passport-FAQ · p.2`, green "Padanan tinggi" chip, domain.
- legacy row: POST without the three new fields → card shows no badge/chip, layout still balanced.
- Bricolage renders (compare against a system-sans screenshot — letterforms clearly different).
Skip if backend can't run; note the skip.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/share/[slug]/ frontend/assets/bricolage-700.woff frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat(share): evidence-receipt OG card with localized confidence chip"
```

---

### Task 4: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full backend suite**

Run (from `backend/`): `.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: 79 passed.

- [ ] **Step 2: Frontend build**

Run (from `frontend/`): `pnpm build`
Expected: success.

- [ ] **Step 3: Migration reminder**

The Supabase migration (Global Constraints) must be run manually in the Supabase SQL editor before the new fields persist in production. Confirm with the user it has been run; live inserts silently drop unknown columns otherwise (PostgREST rejects unknown columns with an error — creating shares would 500 until the migration runs). State this clearly in the final report.

- [ ] **Step 4: Post-deploy validation checklist (report, don't execute)**

Include in the final report: after deploy, validate with (a) Twitter Card Validator on a fresh share URL, (b) send the link to yourself on WhatsApp, (c) `https://lingua-rakyat.my/share/<slug>/opengraph-image` directly. WhatsApp caches previews aggressively — always test with a newly created slug.
