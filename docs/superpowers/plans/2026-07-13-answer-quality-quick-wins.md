# Answer Quality Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize the confidence explanation sentence in the backend so web + Telegram + WhatsApp show one localized reason, consolidate the web answer card's trust UI into a single "evidence receipt", remove dead decorative components, and refresh the stale backlog.

**Architecture:** A pure helper `_confidence_explanation()` in `backend/utils/rag_pipeline.py` builds a deterministic localized sentence from signals `_build_result()` already has; the field rides the existing result dict into `/api/chat/ask`, the stream `complete` event (`{"type": "complete", **result}` at rag_pipeline.py:1748 spreads it automatically), and bot formatters. The frontend prefers the backend field and keeps its old computation only as a fallback for pre-existing cached/history rows.

**Tech Stack:** FastAPI + pytest (backend), Next.js + TypeScript + Tailwind v4 tokens (frontend).

**Spec:** `docs/superpowers/specs/2026-07-13-answer-quality-quick-wins-design.md`

## Global Constraints

- No LLM call for the explanation sentence — deterministic templates only.
- Languages: `en` / `ms` / `zh` template sets; `zh-cn` and `zh` map to `zh`; `id` maps to `ms`; anything else falls back to `en`.
- No raw Tailwind palette colors (`amber-*`, `blue-*`, `purple-*`, hex) in chat-panel components — use theme tokens (`--warning`, `--muted`, etc.).
- Answer text and prompts are untouched — this bundle adds metadata and UI only.
- Backend venv: `cd backend` then `venv\Scripts\activate` (Windows). Frontend: `pnpm` in `frontend/`.

---

### Task 1: Backend `_confidence_explanation()` + wire into `_build_result()`

**Files:**
- Modify: `backend/utils/rag_pipeline.py` (helper near `_confidence_label` at line ~1320; wiring inside `_build_result` at line ~1421)
- Test: `backend/tests/test_confidence_explanation.py` (create)

**Interfaces:**
- Consumes: existing `prepared` dict keys in `_build_result`: `evidence_mode`, `filtered_matches`, `language`; existing `top_score` local.
- Produces: `_confidence_explanation(evidence_mode: str, match_count: int, top_score: float, lang: str, doc_name: str = "") -> Optional[str]` and a new result key `confidence_explanation: str | None` (Tasks 2–3 rely on this exact key name).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_confidence_explanation.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from utils.rag_pipeline import _confidence_explanation


# ── None cases ────────────────────────────────────────────────────────────────

def test_summary_mode_returns_none():
    assert _confidence_explanation("summary", 5, 0.9, "en") is None


def test_strong_high_score_returns_none():
    assert _confidence_explanation("strong", 5, 0.80, "en") is None


def test_strong_at_threshold_returns_none():
    assert _confidence_explanation("strong", 3, 0.75, "en") is None


# ── strong but moderate score ────────────────────────────────────────────────

def test_strong_moderate_en():
    out = _confidence_explanation("strong", 4, 0.62, "en")
    assert out == "4 sources found, best 62% match"


def test_strong_moderate_en_singular():
    out = _confidence_explanation("strong", 1, 0.6, "en")
    assert out == "1 source found, best 60% match"


def test_strong_moderate_ms():
    out = _confidence_explanation("strong", 4, 0.62, "ms")
    assert out == "4 sumber ditemui, padanan terbaik 62%"


def test_strong_moderate_zh():
    out = _confidence_explanation("strong", 4, 0.62, "zh-cn")
    assert out == "找到 4 个来源，最佳匹配 62%"


# ── cautious ─────────────────────────────────────────────────────────────────

def test_cautious_en():
    out = _confidence_explanation("cautious", 2, 0.45, "en")
    assert "2 moderate matches" in out
    assert "45%" in out
    assert "verify with the official source" in out


def test_cautious_en_singular():
    out = _confidence_explanation("cautious", 1, 0.45, "en")
    assert "1 moderate match," in out


def test_cautious_ms():
    out = _confidence_explanation("cautious", 2, 0.45, "ms")
    assert "sahkan dengan sumber rasmi" in out


def test_cautious_zh():
    out = _confidence_explanation("cautious", 2, 0.45, "zh")
    assert "请以官方来源核实" in out


# ── insufficient ─────────────────────────────────────────────────────────────

def test_insufficient_uses_doc_name_and_strips_pdf():
    out = _confidence_explanation("insufficient", 1, 0.3, "en", doc_name="KWSP-2024.pdf")
    assert "KWSP-2024" in out
    assert ".pdf" not in out
    assert "closest passage" in out


def test_insufficient_missing_doc_name_falls_back():
    out = _confidence_explanation("insufficient", 1, 0.3, "en", doc_name="")
    assert "the document" in out


def test_insufficient_ms_doc_fallback():
    out = _confidence_explanation("insufficient", 1, 0.3, "ms", doc_name="")
    assert "dokumen" in out


# ── language fallbacks ───────────────────────────────────────────────────────

def test_unknown_language_falls_back_to_en():
    out = _confidence_explanation("cautious", 2, 0.45, "th")
    assert "verify with the official source" in out


def test_id_maps_to_ms():
    out = _confidence_explanation("cautious", 2, 0.45, "id")
    assert "sahkan dengan sumber rasmi" in out
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/` with venv active): `python -m pytest tests/test_confidence_explanation.py -v`
Expected: FAIL — `ImportError: cannot import name '_confidence_explanation'`

- [ ] **Step 3: Implement the helper**

In `backend/utils/rag_pipeline.py`, insert directly after `_confidence_label()` (ends line ~1325). `Optional` and `re` are already imported in this module.

```python
_EXPLANATION_TEMPLATES: dict[str, dict[str, str]] = {
    "en": {
        "strong_moderate": "{n} source{s} found, best {pct}% match",
        "cautious": (
            "Based on {n} moderate match{es}, top score {pct}% — "
            "answer may be incomplete, verify with the official source"
        ),
        "insufficient": (
            "No strong match found in {doc} — showing the closest passage, "
            "verify with the official source"
        ),
        "doc_fallback": "the document",
    },
    "ms": {
        "strong_moderate": "{n} sumber ditemui, padanan terbaik {pct}%",
        "cautious": (
            "Berdasarkan {n} padanan sederhana, skor tertinggi {pct}% — "
            "jawapan mungkin tidak lengkap, sahkan dengan sumber rasmi"
        ),
        "insufficient": (
            "Tiada padanan kukuh ditemui dalam {doc} — menunjukkan petikan "
            "terdekat, sahkan dengan sumber rasmi"
        ),
        "doc_fallback": "dokumen",
    },
    "zh": {
        "strong_moderate": "找到 {n} 个来源，最佳匹配 {pct}%",
        "cautious": "基于 {n} 个中等匹配，最高分 {pct}% — 答案可能不完整，请以官方来源核实",
        "insufficient": "在 {doc} 中未找到强匹配 — 显示最接近的段落，请以官方来源核实",
        "doc_fallback": "文件",
    },
}


def _confidence_explanation(
    evidence_mode: str,
    match_count: int,
    top_score: float,
    lang: str,
    doc_name: str = "",
) -> Optional[str]:
    """One localized sentence explaining answer confidence. None = no note needed.

    Pure and total: unknown languages fall back to English, missing doc names
    to a generic word. Never raises.
    """
    if evidence_mode == "summary":
        return None
    if evidence_mode == "strong" and top_score >= 0.75:
        return None

    lang = (lang or "").lower()
    key = "zh" if lang.startswith("zh") else "ms" if lang in ("ms", "id") else "en"
    templates = _EXPLANATION_TEMPLATES[key]

    doc = re.sub(r"\.pdf$", "", (doc_name or "").strip(), flags=re.IGNORECASE)
    if not doc:
        doc = templates["doc_fallback"]

    if evidence_mode == "insufficient":
        template = templates["insufficient"]
    elif evidence_mode == "cautious":
        template = templates["cautious"]
    else:  # strong, score below 0.75
        template = templates["strong_moderate"]

    return template.format(
        n=match_count,
        pct=round(top_score * 100),
        doc=doc,
        s="" if match_count == 1 else "s",
        es="" if match_count == 1 else "es",
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_confidence_explanation.py -v`
Expected: all PASS

- [ ] **Step 5: Wire into `_build_result()`**

In `_build_result()` (rag_pipeline.py ~1421), the result dict currently ends:

```python
        "sufficient_evidence": prepared["sufficient_evidence"],
        "evidence_mode": prepared.get("evidence_mode", "strong"),
    }
    return result
```

Change to:

```python
        "sufficient_evidence": prepared["sufficient_evidence"],
        "evidence_mode": prepared.get("evidence_mode", "strong"),
        "confidence_explanation": _confidence_explanation(
            evidence_mode=prepared.get("evidence_mode", "strong"),
            match_count=len(prepared["filtered_matches"]),
            top_score=top_score,
            lang=prepared["language"],
            doc_name=(
                prepared["filtered_matches"][0]["metadata"].get("doc_name", "")
                if prepared["filtered_matches"]
                else ""
            ),
        ),
    }
    return result
```

The stream path needs no change: `yield {"type": "complete", **result}` (line ~1748) spreads the new key automatically.

- [ ] **Step 6: Run full backend test suite**

Run: `python -m pytest tests/ -v`
Expected: all PASS (existing `test_rag_prompts.py`, `test_evaluation.py` unaffected)

- [ ] **Step 7: Commit**

```bash
git add backend/utils/rag_pipeline.py backend/tests/test_confidence_explanation.py
git commit -m "feat(rag): localized confidence_explanation on answer results"
```

---

### Task 2: Bots append the explanation sentence

**Files:**
- Modify: `backend/routers/telegram.py:95-113` (`_format_answer`)
- Modify: `backend/routers/whatsapp.py:116-134` (`_format_answer`)
- Test: `backend/tests/test_bot_answer_format.py` (create)

**Interfaces:**
- Consumes: result dict keys `confidence_explanation` (Task 1) and existing `evidence_mode`.
- Produces: bot answer text ends with `\n⚠ {sentence}` when mode is cautious/insufficient.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_bot_answer_format.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers.telegram import _format_answer as tg_format
from routers.whatsapp import _format_answer as wa_format


def _result(**overrides):
    base = {
        "answer": "You need Form A.",
        "sources": [{"doc_name": "KWSP.pdf", "page_start": 3, "score": 0.42}],
        "language": "en",
        "confidence_label": "low",
        "evidence_mode": "cautious",
        "confidence_explanation": "Based on 1 moderate match, top score 42% — answer may be incomplete, verify with the official source",
    }
    base.update(overrides)
    return base


def test_telegram_appends_warning_when_cautious():
    out = tg_format(_result())
    assert "⚠ Based on 1 moderate match" in out


def test_whatsapp_appends_warning_when_insufficient():
    out = wa_format(_result(evidence_mode="insufficient"))
    assert "⚠" in out


def test_no_warning_when_strong():
    out = tg_format(_result(evidence_mode="strong", confidence_explanation=None))
    assert "⚠" not in out


def test_no_crash_when_field_missing():
    r = _result()
    del r["confidence_explanation"]
    del r["evidence_mode"]
    out = tg_format(r)
    assert "You need Form A." in out
    assert "⚠" not in out
```

Note: if importing the routers fails on missing environment variables, add
`os.environ.setdefault("SUPABASE_URL", "http://localhost")` style lines (for
whichever variable the error names) directly under the `sys.path` line — the
formatters themselves are pure.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_bot_answer_format.py -v`
Expected: FAIL — no `⚠` in output (formatters don't read the field yet)

- [ ] **Step 3: Implement in both formatters**

In **both** `telegram.py` and `whatsapp.py`, the final line of `_format_answer` is:

```python
    return f"{answer}{source_line}\n{confidence_emoji}".strip()
```

Replace (in both files) with:

```python
    note = ""
    if result.get("evidence_mode") in ("cautious", "insufficient"):
        sentence = result.get("confidence_explanation")
        if sentence:
            note = f"\n⚠ {sentence}"

    return f"{answer}{source_line}\n{confidence_emoji}{note}".strip()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_bot_answer_format.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/telegram.py backend/routers/whatsapp.py backend/tests/test_bot_answer_format.py
git commit -m "feat(bots): show confidence explanation on weak answers"
```

---

### Task 3: Frontend — types, plumbing, evidence receipt

**Files:**
- Modify: `frontend/lib/api.ts` (types at lines ~50-84, complete event ~494-510, cacheHistory write ~650-661)
- Modify: `frontend/components/chat-panel/message-cards.tsx` (Message interface ~40, delete CONFIDENCE_MSG ~156-189, delete banner ~555-563, AnswerMetrics call ~565-582)
- Modify: `frontend/components/chat-panel/index.tsx` (rowToMessage ~110, complete mapping ~604, history prepend ~645)
- Modify: `frontend/components/chat-panel/answer-metrics.tsx` (receipt layout)

No unit-test infra exists for the frontend; the test cycle is `pnpm build` + manual states check (Step 8).

- [ ] **Step 1: Add the field to API types (`frontend/lib/api.ts`)**

In `AskResponse` (line ~64), after `sufficient_evidence?: boolean`:

```ts
  sufficient_evidence?: boolean
  faithfulness?: number | null
  evidence_mode?: string
  confidence_explanation?: string | null
```

(If `evidence_mode` already exists on `AskResponse`, only add `confidence_explanation`.)

In `ChatHistoryMessage` (line ~83), after `faithfulness?: number | null`:

```ts
  faithfulness?: number | null
  confidence_explanation?: string | null
```

In the stream `complete` event variant (line ~509), after `faithfulness?: number | null`:

```ts
      faithfulness?: number | null
      confidence_explanation?: string | null
```

In the `cacheHistory([...])` write inside the stream handler (line ~650-661), after `faithfulness: event.faithfulness,`:

```ts
              faithfulness: event.faithfulness,
              confidence_explanation: event.confidence_explanation,
```

- [ ] **Step 2: Plumb through chat-panel state (`index.tsx`)**

Three places:

1. `rowToMessage` (line ~110), after `faithfulness: row.faithfulness ?? null,`:

```ts
    faithfulness: row.faithfulness ?? null,
    confidence_explanation: row.confidence_explanation ?? null,
```

2. Complete-event → Message mapping (line ~604), after `faithfulness: event.faithfulness ?? null,`:

```ts
              faithfulness: event.faithfulness ?? null,
              confidence_explanation: event.confidence_explanation ?? null,
```

3. History prepend (line ~645), after `faithfulness: event.faithfulness ?? null,`:

```ts
                faithfulness: event.faithfulness ?? null,
                confidence_explanation: event.confidence_explanation ?? null,
```

- [ ] **Step 3: Update `Message` interface and remove the duplicate banner (`message-cards.tsx`)**

Add to `Message` interface (line ~56), after `faithfulness?: number | null`:

```ts
  faithfulness?: number | null
  // Localized backend sentence explaining confidence. Absent on rows saved
  // before this field existed — computeConfidenceReason is the fallback.
  confidence_explanation?: string | null
```

Delete entirely:
- the `CONFIDENCE_MSG` const (lines ~156-169)
- the `confidenceSentence()` function (lines ~171-189)
- the amber banner block (lines ~555-563):

```tsx
            {!message.isStreaming && (() => {
              const sentence = confidenceSentence(message)
              return sentence ? (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{sentence}</span>
                </div>
              ) : null
            })()}
```

Keep `computeConfidenceReason()` (lines ~115-150) — it is the fallback.

Replace the `AnswerMetrics` call (lines ~565-582) with:

```tsx
            {!message.isStreaming && !simpleMode && (
              <AnswerMetrics
                confidence={message.confidence}
                faithfulness={message.faithfulness}
                language={message.language}
                sources={message.sources}
                evidenceMode={message.evidence_mode}
                explanation={
                  message.confidence_explanation ??
                  (message.sources.length > 0
                    ? computeConfidenceReason(
                        message.confidence,
                        message.sources,
                        message.sufficient_evidence,
                        message.language,
                      )
                    : undefined)
                }
              />
            )}
```

- [ ] **Step 4: Evidence receipt layout (`answer-metrics.tsx`)**

`MetricBar`, `Breakdown`, `toneFor`, `FILLED_CLASS`, `pct`, and all imports stay unchanged. Replace only the exported `AnswerMetrics` function (lines ~151-223) with:

```tsx
export function AnswerMetrics({
  confidence,
  faithfulness,
  language,
  explanation,
  evidenceMode,
  sources = [],
}: {
  confidence: number
  faithfulness?: number | null
  language: string
  explanation?: string | null
  evidenceMode?: string
  sources?: SourceChunk[]
}) {
  const ms = language === "ms"
  const hasFaithfulness = typeof faithfulness === "number" && faithfulness > 0
  const [open, setOpen] = useState(false)
  const warn = evidenceMode === "cautious" || evidenceMode === "insufficient"

  if (confidence <= 0 && !hasFaithfulness) return null

  const top = sources[0]
  const docName = top?.doc_name ? top.doc_name.replace(/\.pdf$/i, "") : null
  const page = top?.page_start

  return (
    <div
      className={cn(
        "mt-3 max-w-sm space-y-2.5 rounded-xl border px-3 py-2.5",
        warn ? "border-warning/50 bg-warning/5" : "border-border/60 bg-muted/20"
      )}
    >
      {docName && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {docName}
          </span>
          {page ? (
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground/70">
              p.{page}
            </span>
          ) : null}
        </div>
      )}
      {confidence > 0 && (
        <MetricBar
          label={ms ? "Keyakinan" : "Confidence"}
          value={confidence}
          tooltip={
            ms
              ? "Kualiti padanan sumber. Formula: kesamaan vektor × 35% + Cohere rerank × 65%"
              : "Source match quality. Formula: vector similarity × 35% + Cohere rerank × 65%"
          }
        />
      )}
      {hasFaithfulness && (
        <MetricBar
          label={ms ? "Berdasar sumber" : "Grounded"}
          value={faithfulness as number}
          tooltip={
            ms
              ? "Setiap kenyataan dalam jawapan disokong petikan sumber. Tinggi = tiada halusinasi."
              : "Answer stays within source text. High = every claim is backed by retrieved passages, no hallucination."
          }
        />
      )}
      {explanation && (
        <p
          className={cn(
            "text-[10px] leading-relaxed",
            warn ? "font-medium text-foreground/75" : "text-muted-foreground/70"
          )}
        >
          {warn ? "⚠ " : ""}
          {explanation}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:outline-none"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {ms ? "Bagaimana dikira?" : "How calculated?"}
      </button>

      {open && (
        <Breakdown
          confidence={confidence}
          faithfulness={faithfulness}
          sources={sources}
          language={language}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Check for other `confidenceSentence` / `confidenceReason` references**

Run (from `frontend/`): `grep -rn "confidenceSentence\|confidenceReason\|CONFIDENCE_MSG" components app lib`
Expected: no matches. Fix any stragglers (rename to `explanation`).

- [ ] **Step 6: Build**

Run: `pnpm build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/api.ts frontend/components/chat-panel/
git commit -m "feat(ui): evidence receipt consolidates answer trust UI"
```

- [ ] **Step 8: Manual states check (needs backend running)**

Start backend (`uvicorn main:app --reload --port 8000`) and frontend (`pnpm dev`). In `/workspace`:
- Strong answer (e.g., "How do I renew my passport?" on a passport doc): receipt shows doc pill + bars, **no** sentence, neutral border.
- Cautious/low answer (ask something tangential, e.g., "What is the tax rate on cryptocurrency staking?"): warning-tinted border + ⚠ sentence.
- Toggle dark mode: receipt legible in both themes.

Record results in the final report; if backend can't run locally, note it and rely on Step 6 + Task 7.

---

### Task 4: Token hygiene sweep in chat-panel

**Files:**
- Modify: any `frontend/components/chat-panel/*.tsx` still using raw palette colors

- [ ] **Step 1: Find violations**

Run (from `frontend/`): `grep -rn "amber-\|purple-\|violet-\|blue-\|#[0-9a-fA-F]\{3,6\}" components/chat-panel`
Expected after Task 3: few or no hits. Judgment rule: fix color utilities that set a palette hue (`text-blue-600`, `bg-amber-50`, raw hex); leave non-color matches (e.g., IDs, URLs) alone.

- [ ] **Step 2: Replace with tokens**

Mapping: warning/amber states → `warning` token (`border-warning/50`, `bg-warning/10`, `text-warning`); info/blue accents → `primary` or `secondary`; ad-hoc greys → `muted` / `muted-foreground`. If a file has zero violations, this task is a no-op — skip to Step 3 and note it.

- [ ] **Step 3: Build and commit (only if changes made)**

Run: `pnpm build` — expected: success.

```bash
git add frontend/components/chat-panel/
git commit -m "fix(ui): replace raw palette colors with theme tokens in chat panel"
```

---

### Task 5: Delete dead decorative components

**Files:**
- Delete: `frontend/components/PixelBlast.tsx`, `frontend/components/Beams.tsx`, `frontend/components/LogoLoop.tsx`, `frontend/components/TextType.tsx`
- Delete: `frontend/components/ui/hero-liquid-metal.tsx`, `frontend/components/ui/hero-heatmap.tsx`, `frontend/components/ui/terminal-animation.tsx`, `frontend/components/ui/fps.tsx`, `frontend/components/ui/youtube-video-player.tsx`
- Delete: `frontend/imported/` (directory)

- [ ] **Step 1: Re-verify each file is unimported**

Run (from `frontend/`):

```bash
grep -rn "PixelBlast\|components/Beams\|LogoLoop\|TextType\|hero-liquid-metal\|hero-heatmap\|terminal-animation\|ui/fps\|youtube-video-player" app components lib hooks --include="*.tsx" --include="*.ts"
```

Expected: matches only inside the files being deleted. **If any other file imports one, keep that component and remove it from the deletion list.**

- [ ] **Step 2: Delete**

```bash
git rm frontend/components/PixelBlast.tsx frontend/components/Beams.tsx frontend/components/LogoLoop.tsx frontend/components/TextType.tsx
git rm frontend/components/ui/hero-liquid-metal.tsx frontend/components/ui/hero-heatmap.tsx frontend/components/ui/terminal-animation.tsx frontend/components/ui/fps.tsx frontend/components/ui/youtube-video-player.tsx
git rm -r frontend/imported
```

- [ ] **Step 3: Build to prove nothing broke**

Run: `pnpm build`
Expected: success. If an import error names a deleted file, restore it (`git checkout -- <path>`) and re-run.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(ui): remove unused decorative components"
```

---

### Task 6: Refresh `docs/future-improvements.txt`

**Files:**
- Modify: `docs/future-improvements.txt`

- [ ] **Step 1: Flip statuses that are now built**

Exact edits (old → new on the status tag line only; keep detail lines):

1. Line 101 `[TODO] Pre-loaded Government Document Library` → `[DONE] Pre-loaded Government Document Library` (built in commit ee20597).
2. Line 121 `[TODO] Text-to-Speech (TTS) Answers` → `[DONE] Text-to-Speech (TTS) Answers` (endpoints `/api/voice/tts` exist).
3. Line 139 `[TODO] Shareable Answer Links` → `[DONE] Shareable Answer Links` (`/share/[slug]` built).
4. Line 162 `[TODO] Async Ingestion Queue` → `[DONE] Async Ingestion Queue` and append detail line `  - Built as FastAPI BackgroundTasks + frontend status polling (commit 09c767c)`.
5. Line 227 `[TODO] History-Aware Query Rewrite (highest priority)` → `[DONE] History-Aware Query Rewrite` (built: `_condense_query` in rag_pipeline.py).
6. Line 237 `[TODO] Multi-Document Retrieval (no file picking)` → `[DONE] Multi-Document Retrieval` (built: `_resolve_namespaces`).
7. Line 246 `[TODO] Confidence Explanation Sentence` → `[DONE] Confidence Explanation Sentence` and append detail line `  - Built 2026-07-13: _confidence_explanation() in rag_pipeline.py, shown on web receipt + bots`.
8. Line 80 (section 3) `[TODO] Answer Confidence Explanation` → `[DONE] Answer Confidence Explanation` (same work as item 7).

- [ ] **Step 2: Update the header date line**

Line 3 `Generated: 2026-06-08` → `Generated: 2026-06-08 · Statuses refreshed: 2026-07-13`.

- [ ] **Step 3: Commit**

```bash
git add docs/future-improvements.txt
git commit -m "docs: mark shipped items done in future-improvements backlog"
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full backend test suite**

Run (from `backend/`, venv active): `python -m pytest tests/ -v`
Expected: all PASS.

- [ ] **Step 2: Frontend build + lint**

Run (from `frontend/`): `pnpm build` then `pnpm lint`
Expected: both succeed (lint may show pre-existing warnings; no new errors).

- [ ] **Step 3: Eval regression guard (best-effort, needs API keys)**

If the backend runs locally with real keys: `POST http://localhost:8000/api/eval/run-test-suite` against a seeded doc, compare aggregate ROUGE/BLEU with a pre-change run. Expected: no regression — the change adds a metadata field; answer text paths are untouched. If keys are unavailable, state that explicitly in the final report instead of skipping silently.

- [ ] **Step 4: Report**

Summarize: tests run + results, build status, manual receipt check results (from Task 3 Step 8), anything skipped and why.
