# Competition Prep — Lingua Rakyat (RISE 2026)

**Date:** 2026-05-12  
**Competition:** RISE 2026 — demo booth format  
**Timeline:** 4 weeks  
**Primary judge criteria:** Technical innovation, real-world impact  
**Secondary:** UI/UX polish  

---

## Scope

Five targeted improvements to maximize demo reliability, technical credibility, and real-world impact story before competition day. No new pages except `/demo`. No breaking changes to existing chat, eval, or manage flows.

---

## 1. Critical Bug Fix — Chinese Prompt Encoding

**File:** `backend/utils/rag_pipeline.py:983–994`

**Problem:** The `zh-cn` cautious QA prompt string is stored as mojibake — UTF-8 Chinese characters were read as Latin-1 during a prior edit, producing garbled output (`ä½ æ˜¯ä¸€ä½è°¨æ…Žçš„...`). Any Chinese-language query that hits the cautious evidence path returns a broken response.

**Fix:** Replace the garbled literal with correctly encoded Chinese text matching the intent of the English and Malay prompt variants.

**Risk:** None. Single string replacement, no API or schema change.

---

## 2. Evaluation Metrics Enhancement

**Goal:** Elevate eval from ROUGE/BLEU-only to a full RAG evaluation suite judges can see live.

### 2a. Faithfulness Score

**What:** For each query, measure how grounded the generated answer is in the retrieved chunks.

**How:** After answer generation, call `POST https://api.cohere.ai/v1/rerank` with the generated answer as query and the top-k source chunk texts as documents. The highest `relevance_score` from the reranker = faithfulness score for that query. Mean across all queries = aggregate metric.

**Why rerank:** Reuses the existing Cohere multilingual reranker already called during retrieval. No new API key, no new model. Adds ~80–150ms per query (rerank call on short answer text).

**Computation timing:** Faithfulness is computed **after** the answer is streamed to the user, inside the existing eval-record-write code path in `evaluation.py`. It does not block streaming response delivery.

**Where stored:** Add `faithfulness_score: float` column to the `lr_eval_records` Supabase table and `faithfulness_score: float` field to the `EvalRecord` dataclass in `backend/utils/evaluation.py`. Include in `/api/eval/report` aggregate response. Add this column to the same migration file as §4d (`supabase/migrations/2026-05-12-add-featured-docs.sql`).

### 2b. Semantic Similarity

**What:** For test suite cases that have ground truth answers, measure cosine similarity between the generated answer embedding and the ground truth embedding.

**How:** Call `POST https://api.cohere.ai/v1/embed` (model: `embed-multilingual-v3.0`, `input_type: search_document`) on both generated answer and ground truth. Compute cosine similarity. Only computed during test suite runs — not during normal user queries.

**Cross-lingual:** Cohere's multilingual embedder maps answers across languages into the same space. A BM-language answer and EN ground truth score correctly.

**Where stored:** Add `semantic_similarity: float | None` to test suite result records. Expose in `/api/eval` test suite aggregate response and per-case results.

### 2c. Frontend Changes

**Eval dashboard — new metric cards** (added after existing retrieval + readability row):
- `Faithfulness Score` — displays aggregate float (0–1), primary color, sparkle icon
- `Semantic Similarity` — displays aggregate float (0–1), only shown when test suite has been run

**Eval dashboard — ROUGE/BLEU score bars section** gains two new `ScoreBar` entries below existing bars:
- `Faithfulness Score`
- `Semantic Similarity`

**Per-case test result** (expandable rows) gains:
- `Faithfulness: 0.xxx` alongside existing Grade / Confidence / Latency fields

No new pages. All additions fit within existing `MetricCard` and `ScoreBar` components.

---

## 3. Pre-loaded Government Document Library

**Goal:** Judges can immediately query real Malaysian government documents — no upload step needed.

### 3a. Document Selection

Four documents bundled in `backend/sample_docs/`:

| Agency | Document | Language |
|--------|----------|----------|
| LHDN | Panduan e-Filing 2024 | BM / EN |
| KWSP/EPF | Panduan Pengeluaran EPF | BM / EN |
| JPN | Permohonan MyKad FAQ | BM / EN |
| PTPTN | Panduan Peminjam PTPTN | BM |

PDFs sourced from official agency websites (public documents, freely downloadable). Files under 5MB committed directly to `backend/sample_docs/`. Files exceeding 5MB excluded from git and fetched by a one-time setup script: `python backend/scripts/download_sample_docs.py`. The script is committed; the PDFs may not be.

### 3b. Backend Seeding

**New endpoint:** `POST /api/documents/seed`

- Idempotent — checks Supabase for existing records by a stable `doc_id` before ingesting
- For each missing doc: reads PDF from `sample_docs/`, calls `ingest_document()`, writes record to Supabase with `is_featured=True` and `agency` set
- Called automatically on `startup` event in `main.py` via `asyncio.create_task`
- Returns `{seeded: int, already_present: int}`

**Supabase schema migration:**
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS agency varchar(20);
```

Add migration file to `supabase/` directory.

### 3c. API Change

`GET /api/documents` response adds `is_featured` and `agency` fields to each document object. Frontend `Document` type updated accordingly.

### 3d. Frontend — Workspace Doc Picker

Featured documents appear as a separate section at the top of the picker popover, above the "Your uploads" section.

Layout per featured doc row:
- Agency badge (colored square: LHDN=green, KWSP=blue, JPN=purple, PTPTN=red)
- Document name + language subtitle
- `READY` status pill (featured docs are always pre-ingested)

Selecting a featured doc works identically to selecting a user-uploaded doc — sets `selectedDoc` state, triggers chat session.

### 3e. Cache Pre-warm on Boot

On startup, after seeding completes, the server silently fires 3 representative questions against each featured doc using `answer_question()` (non-streaming). These populate `_query_cache` so the first judge query returns in ~200ms instead of ~2s.

Pre-warm questions defined in a `PREWARM_QUESTIONS: dict[str, list[str]]` constant in `backend/routers/documents.py`, keyed by stable `doc_id`. Three questions per doc:
- `"Summarize this document"` (EN, triggers summary path)
- `"Siapa yang layak memohon?"` (BM, eligibility)
- `"What documents do I need?"` (EN, procedure)

---

## 4. P1 Polish

### 4a. Keyboard Navigation Pass

Walk through critical flows keyboard-only: upload modal open/close, doc picker open/select, chat input submit, source accordion expand/collapse, rename inline edit. Add `focus-visible` rings where missing. Ensure modals trap focus correctly.

**Files likely affected:** `components/upload-modal.tsx`, `components/chat-panel/index.tsx`, `app/(app)/manage/page.tsx`

### 4b. Mobile Viewport Fixes

Test at 390px width. Known issues from existing audit:
- Long PDF names overflow in doc picker button — ensure `truncate` + `min-w-0` applied
- Source excerpt text in chat messages overflows — verify `overflow-hidden` on source cards
- Citation preview on mobile needs real-device verification

**Files likely affected:** `app/(app)/workspace/page.tsx`, `components/chat-panel/message-cards.tsx`

### 4c. Remove `orb.tsx`

`components/ui/orb.tsx` exists but an animated glowing orb is an explicit anti-pattern per CLAUDE.md design principles ("no floating orbs"). Verify import usage across codebase — if unused, delete. If used, replace usage with a static civic-green element.

### 4d. Supabase Migration File

Create `supabase/migrations/2026-05-12-add-featured-docs.sql` with the `ALTER TABLE` statements from §3b.

---

## 5. Demo Mode — `/demo` Page

**Goal:** Judges at the booth open one URL and immediately see a guided, working demonstration without needing to navigate the app.

### 5a. Page Route

New page: `frontend/app/demo/page.tsx` (outside the `(app)` layout group — no sidebar, no app shell).

### 5b. Page Layout

- Lingua Rakyat wordmark + "Demo" badge top-left
- Language toggle + theme toggle top-right
- Auto-selects LHDN e-Filing doc on mount (reads from featured doc list)
- Three scenario cards below a brief headline:
  - 🇲🇾 **Bahasa Melayu** — "Siapa yang layak memohon?"
  - 🇬🇧 **English** — "What documents do I need to file?"
  - 🇨🇳 **中文** — "如何申请退税？"
- Clicking a card submits the question to `ChatPanel` (embedded below cards, same component as workspace)
- Scenario cards collapse after first click — chat takes over the remaining space

### 5c. Cache Pre-warm

On `useEffect` mount, silently fire all three scenario questions against the LHDN doc using the non-streaming `askQuestion` API call. By the time a judge clicks a card (~5–10s after page load), answers are cached. Response appears in <300ms.

### 5d. No Auth / No Session Required

`/demo` uses a hardcoded `userId = "demo-user"` and `sessionId = "demo-session"`. Chat history is written to Supabase under these IDs but not shown to the user — page is stateless on refresh.

---

## Implementation Order

1. **Day 1:** Bug fix (#1) — commit, deploy, verify Chinese queries work
2. **Week 1:** Eval backend (#2a, #2b) — new fields in `evaluation.py`, eval router; `faithfulness_score` column added to Supabase migration file
3. **Week 2:** Eval frontend (#2c) + Supabase migration (#4d) + gov doc seeding (#3a–3e)
4. **Week 3:** Workspace featured docs UI (#3d) + P1 polish (#4a–4c)
5. **Week 3–4:** Demo page (#5a–5d) + end-to-end demo rehearsal

---

## Out of Scope

- Multi-document cross-reference (ask across 2+ docs simultaneously)
- High-contrast accessibility mode
- New eval page or separate results page
- Any changes to the benchmark or results pages
