# Competition Bang Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three competition-ready improvements — visible source pills, confidence explanation text, and Supabase-persisted citizen feedback.

**Architecture:** Feature 1 and 2 are pure frontend edits to `message-cards.tsx` and `answer-metrics.tsx`. Feature 3 adds a new `feedback.py` backend router (following the existing router pattern) plus frontend wiring to call it.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, FastAPI, Pydantic v2, Supabase (postgres + service key), pytest + FastAPI TestClient.

**Spec:** `docs/superpowers/specs/2026-06-08-competition-bang-features-design.md`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `frontend/components/chat-panel/message-cards.tsx` | Modify | Pill classes, "view" badge, `computeConfidenceReason()`, new props on `AIMessageCard`, feedback fetch |
| `frontend/components/chat-panel/answer-metrics.tsx` | Modify | Add `confidenceReason` prop + render |
| `frontend/components/chat-panel/index.tsx` | Modify | Pass `sessionId` + `docId` to `AIMessageCard` |
| `backend/routers/feedback.py` | Create | `POST /api/feedback` endpoint |
| `backend/main.py` | Modify | Register feedback router |
| `backend/tests/test_feedback_router.py` | Create | pytest coverage for feedback endpoint |

---

## Task 1: Source Pill Visibility

Make source pill buttons and "view" links visually distinct from the card background.

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`

- [ ] **Step 1: Update SourcePills button classes**

In `message-cards.tsx`, find the `<button>` inside `SourcePills` (around line 154). Replace the `className`:

```tsx
// OLD
className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

// NEW
className="inline-flex items-center gap-1.5 border border-primary/70 bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
```

- [ ] **Step 2: Add ExternalLink icon after page label in SourcePills**

Inside the same button, after the `<span>{pageLabel(pill)}</span>` and the section title span, add an `ExternalLink` icon:

```tsx
{pills.map((pill) => (
  <button
    key={pill.pageStart}
    type="button"
    onClick={() => onPillClick(pill.sourceIndex, pill.pageStart)}
    className="inline-flex items-center gap-1.5 border border-primary/70 bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    aria-label={`${pageLabel(pill)}${pill.sectionTitle ? ` — ${pill.sectionTitle}` : ""}`}
    title={pill.sectionTitle || pageLabel(pill)}
  >
    <FileText className="h-3 w-3 shrink-0" />
    <span>{pageLabel(pill)}</span>
    {pill.sectionTitle ? (
      <span className="max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
        · {pill.sectionTitle}
      </span>
    ) : null}
    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
  </button>
))}
```

- [ ] **Step 3: Update the "view" link inside source cards to a visible badge**

Find the `<button>` inside the source card loop (around line 535 — the one with `onClick={() => onOpenPdf?.(pageStart...)}`). Replace its `className` and icon size:

```tsx
<button
  type="button"
  onClick={() => onOpenPdf?.(pageStart as number, source.text ?? null)}
  className="ml-1 inline-flex items-center gap-1 border border-primary/60 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  title={language === "ms" ? "Lihat halaman asal" : "View source page"}
>
  <ExternalLink className="h-3 w-3" />
  {language === "ms" ? "lihat" : "view"}
</button>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/chat-panel/message-cards.tsx
git commit -m "feat(ui): make source pill buttons and view links visually prominent"
```

---

## Task 2: Confidence Explanation

Add a one-line "why" sentence below the metric bars computed from existing response data.

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`
- Modify: `frontend/components/chat-panel/answer-metrics.tsx`

- [ ] **Step 1: Add `computeConfidenceReason` pure function to message-cards.tsx**

Add this function near the top of `message-cards.tsx`, after the `highlightSourceText` function (around line 94):

```tsx
function computeConfidenceReason(
  confidence: number,
  sources: SourceChunk[],
  sufficientEvidence: boolean,
  language: string,
): string {
  const n = sources.length
  const topScore = sources[0]?.score ?? 0
  const pct = Math.round(topScore * 100)
  const ms = language === "ms"
  const zh = language === "zh-cn" || language === "zh"

  if (!sufficientEvidence) {
    if (zh) return "未找到强匹配 — 显示最接近的段落"
    if (ms) return "Tiada padanan kukuh — menunjukkan petikan terdekat"
    return "No strong match — showing closest passage"
  }
  if (n === 1 && topScore < 0.5) {
    if (zh) return `仅找到 1 个来源，匹配度 ${pct}% — 请以官方文件核实`
    if (ms) return `1 sumber ditemui, padanan ${pct}% — sahkan dengan sumber rasmi`
    return `1 source found, ${pct}% match — verify with official source`
  }
  if (confidence < 0.5) {
    if (zh) return `找到 ${n} 个来源，最佳匹配 ${pct}% — 部分匹配`
    if (ms) return `${n} sumber ditemui, padanan terbaik ${pct}% — padanan separa`
    return `${n} sources found, best ${pct}% — partial match`
  }
  if (confidence < 0.75) {
    if (zh) return `找到 ${n} 个来源，最佳匹配 ${pct}%`
    if (ms) return `${n} sumber ditemui, padanan terbaik ${pct}%`
    return `${n} sources found, best ${pct}% match`
  }
  if (zh) return `找到 ${n} 个来源，匹配强度 ${pct}%`
  if (ms) return `${n} sumber ditemui, kekuatan padanan ${pct}%`
  return `${n} sources found, ${pct}% match strength`
}
```

Note: `SourceChunk` is already imported in this file (`import { SourceChunk } from "@/lib/api"`).

- [ ] **Step 2: Pass confidenceReason to AnswerMetrics in AIMessageCard**

In `AIMessageCard`, find the `<AnswerMetrics>` usage (around line 363). Replace it:

```tsx
{!message.isStreaming && (
  <AnswerMetrics
    confidence={message.confidence}
    faithfulness={message.faithfulness}
    language={message.language}
    confidenceReason={
      message.sources.length > 0
        ? computeConfidenceReason(
            message.confidence,
            message.sources,
            message.sufficient_evidence,
            message.language,
          )
        : undefined
    }
  />
)}
```

- [ ] **Step 3: Add confidenceReason prop to AnswerMetrics and render it**

In `answer-metrics.tsx`, update the component signature and add the render:

```tsx
export function AnswerMetrics({
  confidence,
  faithfulness,
  language,
  confidenceReason,
}: {
  confidence: number
  faithfulness?: number | null
  language: string
  confidenceReason?: string
}) {
  const ms = language === "ms"
  const hasFaithfulness = typeof faithfulness === "number" && faithfulness > 0
  if (confidence <= 0 && !hasFaithfulness) return null

  return (
    <div className="mt-3 max-w-sm space-y-2.5">
      {confidence > 0 ? (
        <MetricBar
          label={ms ? "Keyakinan" : "Confidence"}
          value={confidence}
          title={
            ms
              ? "Keyakinan capaian — sejauh mana petikan sumber sepadan dengan soalan"
              : "Retrieval confidence — how well the sources match the question"
          }
        />
      ) : null}
      {hasFaithfulness ? (
        <MetricBar
          label={ms ? "Berdasar sumber" : "Grounded"}
          value={faithfulness as number}
          title={
            ms
              ? "Sejauh mana jawapan ini berasaskan petikan sumber"
              : "How well this answer is grounded in the source excerpts"
          }
        />
      ) : null}
      {confidenceReason ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          {confidenceReason}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/chat-panel/message-cards.tsx frontend/components/chat-panel/answer-metrics.tsx
git commit -m "feat(ui): add confidence explanation text below metric bars"
```

---

## Task 3: Supabase Schema

Create the `lr_feedback` table.

- [ ] **Step 1: Run SQL in Supabase dashboard**

Go to your Supabase project → SQL Editor → New query. Paste and run:

```sql
create table if not exists lr_feedback (
  id         uuid        default gen_random_uuid() primary key,
  session_id text,
  question   text,
  doc_id     text,
  feedback   text        check (feedback in ('up', 'down')),
  created_at timestamptz default now()
);
```

Expected: table `lr_feedback` appears in Table Editor with 5 columns.

- [ ] **Step 2: Verify table exists**

In Supabase Table Editor, confirm `lr_feedback` is visible with columns: `id`, `session_id`, `question`, `doc_id`, `feedback`, `created_at`.

---

## Task 4: Feedback Backend Router

**Files:**
- Create: `backend/routers/feedback.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_feedback_router.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_feedback_router.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


def _make_client():
    from main import app
    return TestClient(app)


def test_feedback_up_returns_ok():
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
    with patch("routers.feedback.get_supabase", return_value=mock_sb):
        client = _make_client()
        resp = client.post("/api/feedback", json={
            "session_id": "sess-abc",
            "question": "What is MyKad?",
            "doc_id": "doc-123",
            "feedback": "up",
        })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_feedback_down_returns_ok():
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
    with patch("routers.feedback.get_supabase", return_value=mock_sb):
        client = _make_client()
        resp = client.post("/api/feedback", json={
            "session_id": "sess-xyz",
            "question": "KWSP withdrawal age?",
            "doc_id": "doc-456",
            "feedback": "down",
        })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_feedback_invalid_value_rejected():
    client = _make_client()
    resp = client.post("/api/feedback", json={
        "session_id": "sess-abc",
        "question": "Test",
        "doc_id": "doc-123",
        "feedback": "maybe",
    })
    assert resp.status_code == 422


def test_feedback_db_failure_still_returns_ok():
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception("DB down")
    with patch("routers.feedback.get_supabase", return_value=mock_sb):
        client = _make_client()
        resp = client.post("/api/feedback", json={
            "session_id": "sess-abc",
            "question": "Test",
            "doc_id": "doc-123",
            "feedback": "up",
        })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_feedback_router.py -v
```

Expected: `ImportError` or `404` failures (router not yet registered).

- [ ] **Step 3: Create the feedback router**

Create `backend/routers/feedback.py`:

```python
import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from routers.documents import get_supabase

logger = logging.getLogger("feedback_router")
router = APIRouter()


class FeedbackRequest(BaseModel):
    session_id: str
    question: str
    doc_id: str
    feedback: Literal["up", "down"]


@router.post("")
async def submit_feedback(body: FeedbackRequest):
    try:
        get_supabase().table("lr_feedback").insert({
            "session_id": body.session_id,
            "question": body.question,
            "doc_id": body.doc_id,
            "feedback": body.feedback,
        }).execute()
    except Exception as exc:
        logger.warning("[Feedback] DB insert failed: %s", exc)
    return {"ok": True}
```

- [ ] **Step 4: Register router in main.py**

In `backend/main.py`, add after line 56 (the telegram import):

```python
from routers.feedback import router as feedback_router
```

And after line 156 (the telegram include_router):

```python
app.include_router(feedback_router, prefix="/api/feedback", tags=["Feedback"])
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_feedback_router.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd backend && python -m pytest -v
```

Expected: all tests pass (was 25/25 before this task; now 29/29).

- [ ] **Step 7: Commit**

```bash
git add backend/routers/feedback.py backend/main.py backend/tests/test_feedback_router.py
git commit -m "feat(api): add POST /api/feedback endpoint persisting to Supabase lr_feedback"
```

---

## Task 5: Frontend Feedback Wiring

Connect the existing thumb buttons to the new API endpoint.

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`
- Modify: `frontend/components/chat-panel/index.tsx`

- [ ] **Step 1: Add sessionId and docId props to AIMessageCard**

In `message-cards.tsx`, update the `AIMessageCard` props interface (around line 186):

```tsx
export function AIMessageCard({
  message,
  index,
  isLatest,
  expandedSources,
  toggleSources,
  copiedId,
  copyToClipboard,
  docPublicUrl,
  autoSpeak,
  onOpenPdf,
  onSuggestionClick,
  sessionId,
  docId,
}: {
  message: Message
  index: number
  isLatest: boolean
  expandedSources: Set<number>
  toggleSources: (index: number) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
  docPublicUrl?: string
  autoSpeak?: boolean
  onOpenPdf?: (page: number, text: string | null) => void
  onSuggestionClick?: (question: string) => void
  sessionId?: string
  docId?: string
})
```

- [ ] **Step 2: Replace local feedback state with handleFeedback callback**

In `AIMessageCard`, find the `const [feedback, setFeedback] = React.useState<"up" | "down" | null>(null)` line (around line 209). Keep it. Add a new `handleFeedback` callback after the existing `handlePillClick`:

```tsx
const handleFeedback = React.useCallback(
  async (value: "up" | "down") => {
    const next = feedback === value ? null : value
    setFeedback(next)
    if (!next || !sessionId) return
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question: message.question,
          doc_id: docId ?? message.sources[0]?.document_id ?? "",
          feedback: next,
        }),
      })
    } catch {
      // silent — don't interrupt demo on network failure
    }
  },
  [feedback, sessionId, docId, message.question, message.sources],
)
```

- [ ] **Step 3: Update thumb buttons to use handleFeedback**

Find the thumbs up and thumbs down buttons (around line 413–438). Change their `onClick` handlers:

```tsx
// Thumbs up
<button
  type="button"
  onClick={() => handleFeedback("up")}
  className={[
    "p-1 transition-colors hover:text-success",
    feedback === "up"
      ? "text-success"
      : "text-muted-foreground/40",
  ].join(" ")}
  title={language === "ms" ? "Jawapan berguna" : "Helpful"}
>
  <ThumbsUp className="h-3.5 w-3.5" />
</button>
// Thumbs down
<button
  type="button"
  onClick={() => handleFeedback("down")}
  className={[
    "p-1 transition-colors hover:text-destructive",
    feedback === "down"
      ? "text-destructive"
      : "text-muted-foreground/40",
  ].join(" ")}
  title={language === "ms" ? "Jawapan tidak berguna" : "Not helpful"}
>
  <ThumbsDown className="h-3.5 w-3.5" />
</button>
```

- [ ] **Step 4: Pass sessionId and docId from index.tsx**

In `frontend/components/chat-panel/index.tsx`, find the `<AIMessageCard` usage (line 1117). Add two props:

```tsx
<AIMessageCard
  message={message}
  index={index}
  isLatest={index === messages.length - 1}
  expandedSources={expandedSources}
  toggleSources={toggleSources}
  copiedId={copiedId}
  copyToClipboard={copyToClipboard}
  docPublicUrl={selectedDoc?.public_url ?? undefined}
  autoSpeak={autoSpeak}
  onOpenPdf={handleOpenPdf}
  onSuggestionClick={handleSuggestionClick}
  sessionId={sessionId}
  docId={selectedDoc?.id}
/>
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6: Manual smoke test**

1. Start the app (`npm run dev` in frontend, backend running)
2. Upload a document and ask a question
3. Click thumbs up on an answer
4. Open Supabase dashboard → Table Editor → `lr_feedback`
5. Verify a new row appears with correct `session_id`, `question`, `doc_id`, `feedback = "up"`
6. Click same thumb again — row is NOT added (toggle to null, no API call)
7. Click thumbs down — new row with `feedback = "down"`

- [ ] **Step 7: Commit**

```bash
git add frontend/components/chat-panel/message-cards.tsx frontend/components/chat-panel/index.tsx
git commit -m "feat(ui): wire feedback thumbs to POST /api/feedback -> Supabase lr_feedback"
```

---

## Self-Review

**Spec coverage:**
- ✅ Source pill `border-primary/30` → `border-primary/70`, bg bump: Task 1 Steps 1-2
- ✅ "view" link → badge button: Task 1 Step 3
- ✅ Confidence explanation all 5 branches: Task 2 Steps 1-3
- ✅ Supabase schema: Task 3
- ✅ `POST /api/feedback` fire-and-forget, DB errors swallowed: Task 4 Step 3
- ✅ Optimistic UI + silent failure: Task 5 Steps 2-3
- ✅ `doc_id` from `message.sources[0]?.document_id`: Task 5 Step 2

**Out-of-scope confirmed excluded:** feedback dashboard, rate limiting, auth.
