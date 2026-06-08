# Competition Bang Features — Design Spec
**Date:** 2026-06-08  
**Status:** Approved  
**Scope:** Three high-impact UI/UX improvements for RISE 2026 demo

---

## Overview

Three features targeting judge impressiveness and citizen usability:

1. **Source pill visibility** — make PDF-jump buttons obviously clickable
2. **Confidence explanation** — one-line "why" below the metric bars
3. **Citizen feedback → Supabase** — persist thumbs up/down to `lr_feedback`

---

## Feature 1: Source Pill Visibility

### Problem
`SourcePills` component uses `border-primary/30 bg-primary/5` — barely distinguishable from card background. The "view" link inside source cards is `text-primary/70 text-[10px]` — ghost text, not readable as a button.

### Changes

**`SourcePills` button** (`message-cards.tsx:158`):
- `border-primary/30` → `border-primary/70`
- `bg-primary/5` → `bg-primary/15`
- `hover:bg-primary/10` → `hover:bg-primary/25`
- `ExternalLink` icon size: keep `h-3 w-3` but add it after the page label (currently only `FileText` is shown)

**"view" link in source cards** (`message-cards.tsx:538`):
- Convert from inline text link to small pill badge
- Class: `inline-flex items-center gap-1 border border-primary/60 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors rounded-sm`
- Icon: `ExternalLink h-3 w-3` (bump from h-2.5 w-2.5)
- Label: keep "view" / "lihat"

### Files
- `frontend/components/chat-panel/message-cards.tsx`

---

## Feature 2: Confidence Explanation

### Problem
`AnswerMetrics` shows segmented bars but no explanation of why confidence is low. Judges don't know if 42% means "weak match" or "only 1 chunk found".

### Approach
Frontend-only — all required data already in the API response. No backend change.

### Logic
Compute `confidenceReason: string` in `AIMessageCard` from:
- `message.confidence` (float 0–1)
- `message.confidence_label` ("high" | "medium" | "low")
- `message.sufficient_evidence` (bool)
- `message.sources.length`
- `message.sources[0]?.score`

| Condition | English | Malay |
|---|---|---|
| `!sufficient_evidence` | "No strong match — showing closest passage" | "Tiada padanan kukuh — menunjukkan petikan terdekat" |
| 1 source, score < 0.5 | "1 source, {pct}% match — verify with official source" | "1 sumber, {pct}% padanan — sahkan dengan sumber rasmi" |
| confidence < 0.5 | "{n} sources, best {pct}% — partial match" | "{n} sumber, terbaik {pct}% — padanan separa" |
| confidence < 0.75 | "{n} sources, best {pct}% match" | "{n} sumber, padanan {pct}%" |
| confidence ≥ 0.75 | "{n} sources, {pct}% match strength" | "{n} sumber, kekuatan padanan {pct}%" |

Chinese: same pattern with 个来源/匹配度/最佳.

### UI
Add `confidenceReason?: string` prop to `AnswerMetrics`. Render below the bars:
```tsx
{confidenceReason && (
  <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
    {confidenceReason}
  </p>
)}
```

### Files
- `frontend/components/chat-panel/answer-metrics.tsx` — add `confidenceReason` prop + render
- `frontend/components/chat-panel/message-cards.tsx` — compute reason string, pass to `AnswerMetrics`

---

## Feature 3: Citizen Feedback → Supabase

### Schema
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
No RLS required — write-only from backend service key.

### Backend
New file: `backend/routers/feedback.py`

```
POST /api/feedback
Body: { session_id: str, question: str, doc_id: str, feedback: "up" | "down" }
Response: 200 { "ok": true } | 422 validation error
```

- Uses existing Supabase client pattern from other routers
- No auth required (anonymous citizens)
- Fire-and-forget: DB errors logged, never returned as 5xx to client

Register in `backend/main.py` alongside other routers.

### Frontend
Pass two new props to `AIMessageCard`:
- `sessionId: string` — from parent component (existing session state)
- `docId: string` — from `message.sources[0]?.document_id ?? ""`

On thumb click:
1. Optimistic local state update (instant UI)
2. Async `fetch('/api/feedback', { method: 'POST', ... })` — fire-and-forget
3. Errors swallowed silently (no toast — don't risk crashing demo)
4. Toggle: clicking same thumb again sets `null` (no un-submit API call)

### Files
- `backend/routers/feedback.py` — new file
- `backend/main.py` — register router
- `frontend/components/chat-panel/message-cards.tsx` — add sessionId/docId props, wire fetch
- `frontend/components/chat-panel/index.tsx` — pass sessionId/docId to AIMessageCard

---

## Out of Scope
- Feedback read-back / dashboard display (future)
- Feedback auth / de-duplication
- Print/export answer PDF
- Rate limiting on feedback endpoint

---

## Test Plan
1. Source pills: visually confirm pills are distinct from card background in both light and dark mode
2. Confidence reason: check all 5 branches render correct string (low/medium/high/no-evidence/single-source)
3. Feedback: submit thumbs up → check `lr_feedback` table in Supabase dashboard has new row
4. Feedback: network failure → UI still shows toggled state, no error shown
