# Answer Quality Quick Wins — Design

**Date:** 2026-07-13
**Status:** Approved for planning

## Goal

Improve answer trust and UI coherence with a low-risk bundle: centralize the
confidence explanation sentence in the backend so every channel (web, Telegram,
WhatsApp) shows the same localized reason, consolidate the web answer card's
scattered trust UI into a single "evidence receipt", clean token drift and dead
decorative components, and refresh the stale improvements backlog.

## Background / Current State

- `backend/utils/rag_pipeline.py` already computes every signal needed for an
  explanation sentence: `evidence_mode` (strong / cautious / insufficient /
  summary), match count, `top_score`, `faithfulness`, per-source `doc_name`,
  `multi_doc`. It sends **no** explanation text.
- The web frontend computes an explanation **twice**, independently:
  - `confidenceSentence()` (`message-cards.tsx:171`) → amber warning banner,
    styled with hardcoded Tailwind `amber-*` classes (off-token).
  - `computeConfidenceReason()` (`message-cards.tsx:115`) → small grey reason
    text under the metric bars in `AnswerMetrics`.
- Telegram and WhatsApp bots show only a 🟢🟡🔴 emoji — no reason.
- Nine decorative components are unused (no imports outside their own files):
  `PixelBlast.tsx`, `Beams.tsx`, `LogoLoop.tsx`, `TextType.tsx`,
  `ui/hero-liquid-metal.tsx`, `ui/hero-heatmap.tsx`, `ui/terminal-animation.tsx`,
  `ui/fps.tsx`, `ui/youtube-video-player.tsx` — plus `frontend/imported/`
  (scratch HTML). Several contain gradient-heavy "AI tell" styling the design
  principles ban.
- `docs/future-improvements.txt` is stale: history-aware rewrite, multi-doc
  retrieval, TTS, share links, and the confidence sentence are all built but
  still listed `[TODO]`.

## Design

### 1. Backend: `confidence_explanation` field

**Where:** `_build_result()` in `backend/utils/rag_pipeline.py`, via a new
pure helper `_confidence_explanation(...)`.

**Inputs:** `evidence_mode`, match count, `top_score`, language, `multi_doc`,
doc name of the top match.

**Output:** `confidence_explanation: str | None` added to the result dict
(present on both `/api/chat/ask` and `/api/chat/ask-stream` final payloads,
since both build results through `_build_result()`).

**Rules (deterministic templates, no LLM call):**

| Condition | en template (ms/zh equivalents) |
|---|---|
| `evidence_mode == "summary"` | `None` (no sentence) |
| `evidence_mode == "strong"` and `top_score >= 0.75` | `None` (badge suffices, avoid noise) |
| `evidence_mode == "strong"` and `top_score < 0.75` | "{n} sources found, best {pct}% match" |
| `evidence_mode == "cautious"` | "Based on {n} moderate match(es), top score {pct}% — answer may be incomplete, verify with the official source" |
| `evidence_mode == "insufficient"` | "No strong match found in {doc_name} — showing the closest passage, verify with the official source" |

- Multi-doc: when `multi_doc` and the sentence names a document, use the top
  match's `doc_name` (strip `.pdf`); single-doc insufficient uses the doc name
  too since it is available.
- Localization: three template sets keyed by `en` / `ms` / `zh` (language codes
  already normalized by `detect_language`; `zh-cn` maps to `zh` templates,
  unknown codes fall back to `en`).
- Singular/plural handled per language (en only; ms and zh need no plural forms).

### 2. Web: evidence receipt (consolidated trust UI)

Replace the four overlapping trust elements (amber banner, two metric bars,
grey reason text, "How calculated?" toggle) with one compact **evidence
receipt** block at the foot of the AI answer card — styled like an official
document proof slip, matching the civic brand.

**Structure (top to bottom inside one bordered block):**

1. Header row: top source doc name + page pill (reuses existing source data),
   right-aligned confidence percentage.
2. Segmented match bar (existing `MetricBar` visual, kept) and, when present,
   the grounded/faithfulness bar.
3. Explanation sentence: `message.confidence_explanation` from the backend.
   Low/cautious states tint the receipt border and sentence with the
   `--warning` token (replacing the amber banner entirely).
4. "How calculated?" expandable breakdown — kept as is.

**Component changes:**

- `answer-metrics.tsx`: absorbs the receipt layout; `confidenceReason` prop
  renamed to `explanation`; receives `evidence_mode` to pick the warning tint.
- `message-cards.tsx`: delete `confidenceSentence()`, `CONFIDENCE_MSG`, and the
  amber banner JSX. Keep `computeConfidenceReason()` **only** as a fallback for
  messages lacking `confidence_explanation` (cached offline answers, persisted
  chat history rows created before this change); prefer the backend field when
  present.
- No layout change elsewhere in the card (answer text, source pills,
  suggestions untouched).

### 3. Bots: append explanation

- `telegram.py` and `whatsapp.py` answer formatters: when
  `confidence_explanation` is non-null and `evidence_mode` is `cautious` or
  `insufficient`, append `\n⚠ {sentence}` after the sources line. High/strong
  answers stay unchanged (emoji only).

### 4. Token hygiene

- Remove all raw `amber-*` classes in `frontend/components/chat-panel/` (the
  banner is deleted; any remaining low-confidence styling uses
  `--warning` / `--warning-foreground` tokens).
- Quick sweep of chat-panel components for other one-off palette values; fix
  only clear violations (raw hex / non-token Tailwind palette colors).

### 5. Dead component cleanup

Delete (verified unused by import search):

- `frontend/components/PixelBlast.tsx`, `Beams.tsx`, `LogoLoop.tsx`, `TextType.tsx`
- `frontend/components/ui/hero-liquid-metal.tsx`, `hero-heatmap.tsx`,
  `terminal-animation.tsx`, `fps.tsx`, `youtube-video-player.tsx`
- `frontend/imported/` directory

Re-verify each with a grep for its import path immediately before deletion;
`pnpm build` must pass afterwards.

### 6. Backlog refresh

Update `docs/future-improvements.txt`: mark `[DONE]` — history-aware query
rewrite, multi-document retrieval, TTS answers, shareable answer links,
confidence explanation sentence (this work). Add pointer note that section 9's
remaining items are the confidence explanation (done here) and the deferred
agent loop.

## Error Handling

- `_confidence_explanation()` is pure and total: any missing signal (empty
  matches, unknown language) returns `None` or falls back to `en` — never
  raises. A `None` field is valid in every consumer.
- Frontend renders nothing when both `confidence_explanation` and the fallback
  computation yield nothing (e.g., summary answers) — same as today.
- Bots treat a missing field as absent (no crash on old cached payloads).

## Testing

- **Backend unit tests** (`backend/tests/`): table-driven tests for
  `_confidence_explanation()` covering all evidence modes × 3 languages ×
  single/multi-doc, plus fallback-to-en and `None` cases.
- **Regression guard:** run the eval test suite (`POST /api/eval/run-test-suite`
  path via existing pytest or manual run) before and after backend changes;
  scores must not regress (the change adds a field, answer text untouched).
- **Frontend:** `pnpm build` + `pnpm lint` pass; manual check of receipt in all
  three confidence states (force via low-relevance question) in light + dark.
- **Bots:** manual Telegram sandbox check of one low-confidence answer.

## Out of Scope

- Table extraction, source-page highlight overlay, agent loop, prompt changes.
- Redesign of landing page or other pages.
- High-contrast mode and keyboard audit (tracked in ui-polish-audit.md P1s).
