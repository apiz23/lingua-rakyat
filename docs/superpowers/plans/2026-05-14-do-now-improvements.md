# Do-Now Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three targeted backend/frontend improvements: batch Cohere embedding calls, load eval records from Supabase on startup, and add an inline PDF page viewer to source citations.

**Architecture:** All three tasks are independent — Task 1 is a pure backend optimisation, Task 2 is a backend data-loading fix, Task 3 is a frontend UI addition. Each can be implemented and committed separately without breaking the others.

**Tech Stack:** FastAPI/Python (backend), Next.js/TypeScript/shadcn-ui (frontend), Cohere API, Supabase, Pinecone

---

## File Map

| File | Change |
|------|--------|
| `backend/utils/rag_pipeline.py` | Batch embed all query variants in one Cohere call |
| `backend/utils/evaluation.py` | Add `load_fn` param to `Evaluator.__init__`; populate `_records` at init |
| `backend/routers/eval.py` | Add `_load_eval_records` fn; pass as `load_fn` to `Evaluator` |
| `frontend/components/chat-panel/message-cards.tsx` | Add `docPublicUrl` prop + "View page" Dialog to source citations |
| `frontend/components/chat-panel/index.tsx` | Pass `selectedDoc?.public_url` to `AIMessageCard` |

---

## Task 1 — Batch Query-Variant Embeddings

**Files:**
- Modify: `backend/utils/rag_pipeline.py:869-912`

### Background
`_retrieve_matches` currently calls `get_embeddings_cohere([single_text])` once per query variant in a loop. With 4 variants this is 4 sequential HTTP calls (~600-900ms wasted). Cohere's `/v1/embed` accepts up to 96 texts in one call.

- [ ] **Step 1: Write a failing test**

Create `backend/tests/test_rag_pipeline_batch_embed.py`:

```python
"""Test that _retrieve_matches calls get_embeddings_cohere exactly once."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock, call
import utils.rag_pipeline as rag


def test_batch_embed_called_once_for_multiple_variants():
    variants = [
        {"key": "en", "text": "what is mykad", "variant_type": "original"},
        {"key": "ms", "text": "apakah mykad", "variant_type": "translation"},
        {"key": "zh-cn", "text": "什么是身份证", "variant_type": "translation"},
    ]
    fake_embeddings = [[0.1] * 1024, [0.2] * 1024, [0.3] * 1024]
    fake_pinecone_result = {"matches": []}

    with patch.object(rag, "get_embeddings_cohere", return_value=fake_embeddings) as mock_embed, \
         patch.object(rag, "_get_index") as mock_index, \
         patch.object(rag, "_cohere_rerank", side_effect=lambda q, m, k: m[:k]):
        mock_index.return_value.query.return_value = fake_pinecone_result
        rag._retrieve_matches("doc-123", variants, top_k=5)

    # Must be called exactly once with all 3 variant texts
    mock_embed.assert_called_once_with(
        ["what is mykad", "apakah mykad", "什么是身份证"],
        input_type="search_query",
    )
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd backend
python -m pytest tests/test_rag_pipeline_batch_embed.py -v
```

Expected: `FAILED — AssertionError: Expected call ... but was called 3 times`

- [ ] **Step 3: Implement batch embedding in `_retrieve_matches`**

Replace lines 874-897 in `backend/utils/rag_pipeline.py`:

```python
def _retrieve_matches(
    document_id: str,
    query_variants: list[dict[str, str]],
    top_k: int,
) -> list[dict[str, Any]]:
    index = _get_index()
    all_matches: list[dict[str, Any]] = []

    # Batch-embed all variant texts in a single Cohere call
    variant_texts = [v["text"] for v in query_variants]
    embeddings = get_embeddings_cohere(variant_texts, input_type="search_query")

    for variant, embedding in zip(query_variants, embeddings):
        results = index.query(
            vector=embedding,
            top_k=top_k,
            namespace=document_id,
            include_metadata=True,
        )

        for match in results["matches"]:
            metadata = match.get("metadata", {})
            reranked_score = min(1.0, match.get("score", 0.0) + _query_variant_weight(variant["variant_type"]))
            all_matches.append({
                "id": match.get("id"),
                "score": match.get("score", 0.0),
                "reranked_score": reranked_score,
                "metadata": metadata,
                "variant_key": variant["key"],
                "variant_text": variant["text"],
                "variant_type": variant["variant_type"],
            })

    deduped_by_chunk: dict[str, dict[str, Any]] = {}
    for match in all_matches:
        chunk_identity = match["id"] or match["metadata"].get("text", "")[:200]
        current = deduped_by_chunk.get(chunk_identity)
        if current is None or match["reranked_score"] > current["reranked_score"]:
            deduped_by_chunk[chunk_identity] = match

    reranked = sorted(
        deduped_by_chunk.values(),
        key=lambda item: (item["reranked_score"], item["score"]),
        reverse=True,
    )
    primary_question = query_variants[0]["text"] if query_variants else ""
    return _cohere_rerank(primary_question, reranked, top_k)
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd backend
python -m pytest tests/test_rag_pipeline_batch_embed.py -v
```

Expected: `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/utils/rag_pipeline.py backend/tests/test_rag_pipeline_batch_embed.py
git commit -m "perf: batch Cohere embed call for query variants in _retrieve_matches"
```

---

## Task 2 — Load Eval Records from Supabase on Startup

**Files:**
- Modify: `backend/utils/evaluation.py:199-201`
- Modify: `backend/routers/eval.py:37-44`

### Background
`Evaluator.__init__` starts with `_records = []`. Each record is written to Supabase `lr_eval_records` via `persist_fn`, but nothing reads them back after a restart. The health check and `/eval/report` endpoint show 0 records every restart.

- [ ] **Step 1: Write a failing test**

Create `backend/tests/test_evaluator_load.py`:

```python
"""Test that Evaluator loads records from Supabase on init via load_fn."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.evaluation import Evaluator


def test_evaluator_loads_records_from_load_fn():
    seeded = [
        {"question": "q1", "language": "en", "confidence": 0.9, "latency_ms": 200,
         "fk_grade": 4.1, "has_ground_truth": False, "answer_len": 80, "timestamp": "2026-01-01T00:00:00Z"},
        {"question": "q2", "language": "ms", "confidence": 0.7, "latency_ms": 300,
         "fk_grade": 5.2, "has_ground_truth": False, "answer_len": 95, "timestamp": "2026-01-02T00:00:00Z"},
    ]
    ev = Evaluator(load_fn=lambda: seeded)
    assert len(ev) == 2


def test_evaluator_empty_when_no_load_fn():
    ev = Evaluator()
    assert len(ev) == 0


def test_evaluator_load_fn_failure_is_swallowed():
    def bad_load():
        raise RuntimeError("Supabase down")
    ev = Evaluator(load_fn=bad_load)  # must not raise
    assert len(ev) == 0
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd backend
python -m pytest tests/test_evaluator_load.py -v
```

Expected: `FAILED — TypeError: __init__() got an unexpected keyword argument 'load_fn'`

- [ ] **Step 3: Add `load_fn` to `Evaluator.__init__` and `__len__`**

In `backend/utils/evaluation.py`, replace the `__init__` method (lines 199-201):

```python
def __init__(
    self,
    persist_fn: Optional[Callable[[dict], None]] = None,
    load_fn: Optional[Callable[[], list[dict]]] = None,
):
    self._records: list[dict] = []
    self._persist_fn = persist_fn
    if load_fn is not None:
        try:
            self._records = list(load_fn())
            logger.info("[Eval] Loaded %d records from persistence", len(self._records))
        except Exception as exc:
            logger.warning("[Eval] Could not load records from persistence: %s", exc)

def __len__(self) -> int:
    return len(self._records)
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd backend
python -m pytest tests/test_evaluator_load.py -v
```

Expected: all 3 tests `PASSED`

- [ ] **Step 5: Add `_load_eval_records` to `routers/eval.py` and wire it**

In `backend/routers/eval.py`, replace lines 37-44:

```python
def _persist_eval_record(record: dict) -> None:
    from routers.documents import get_supabase
    table = os.getenv("EVAL_TABLE", "lr_eval_records")
    get_supabase().table(table).insert(record).execute()


def _load_eval_records() -> list[dict]:
    from routers.documents import get_supabase
    table = os.getenv("EVAL_TABLE", "lr_eval_records")
    response = (
        get_supabase()
        .table(table)
        .select("*")
        .order("timestamp", desc=True)
        .limit(1000)
        .execute()
    )
    return response.data or []


# ─── Shared evaluator — writes to Supabase lr_eval_records on each record ────
_evaluator = Evaluator(persist_fn=_persist_eval_record, load_fn=_load_eval_records)
```

- [ ] **Step 6: Verify server starts without error**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Expected log lines:
```
[Eval] Loaded N records from persistence
```
(N = however many rows are in `lr_eval_records`. 0 is fine if table is empty.)

If `lr_eval_records` table doesn't exist yet, Supabase will return an error — the `load_fn` failure is swallowed so startup still succeeds.

- [ ] **Step 7: Commit**

```bash
git add backend/utils/evaluation.py backend/routers/eval.py backend/tests/test_evaluator_load.py
git commit -m "feat: load eval records from Supabase on startup"
```

---

## Task 3 — Inline PDF Page Viewer

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`
- Modify: `frontend/components/chat-panel/index.tsx`

### Background
Source citations already show `page_start`/`page_end`. `Document.public_url` holds the Supabase Storage URL for the PDF. Adding a "View page" button that opens an `<iframe>` in a Dialog lets users verify answers against the original PDF — zero new dependencies.

- [ ] **Step 1: Add Dialog import and `docPublicUrl` prop to `AIMessageCard`**

In `frontend/components/chat-panel/message-cards.tsx`, add to the existing imports from `"lucide-react"`:

```typescript
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  User,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,   // add this
} from "lucide-react"
```

Add Dialog imports after the existing lucide import block:

```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
```

Update the `AIMessageCard` props interface (lines 97-104):

```typescript
export function AIMessageCard({
  message,
  index,
  isLatest,
  expandedSources,
  toggleSources,
  copiedId,
  copyToClipboard,
  docPublicUrl,
}: {
  message: Message
  index: number
  isLatest: boolean
  expandedSources: Set<number>
  toggleSources: (index: number) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
  docPublicUrl?: string
}) {
```

- [ ] **Step 2: Add viewer state and Dialog to `AIMessageCard`**

Inside the `AIMessageCard` function body, after the existing `feedback` state (around line 115), add:

```typescript
const [viewerPage, setViewerPage] = React.useState<number | null>(null)
```

At the very end of the returned JSX, just before the closing `</div>` of the outer wrapper (after the sources AnimatePresence block, before line 436), add the Dialog:

```tsx
{docPublicUrl && viewerPage !== null ? (
  <Dialog open onOpenChange={() => setViewerPage(null)}>
    <DialogContent className="max-w-4xl p-0 sm:max-h-[90vh]">
      <DialogHeader className="border-b border-border px-4 py-3">
        <DialogTitle className="text-sm font-medium">
          {message.sources.find(
            (s) => s.page_start === viewerPage
          )?.doc_name ?? "Document"}{" "}
          — {language === "ms" ? "Halaman" : "Page"} {viewerPage}
        </DialogTitle>
      </DialogHeader>
      <iframe
        src={`${docPublicUrl}#page=${viewerPage}`}
        className="h-[75vh] w-full border-0"
        title={`Page ${viewerPage}`}
      />
    </DialogContent>
  </Dialog>
) : null}
```

- [ ] **Step 3: Add "View page" button to each source citation**

Inside the source map (around line 377), in the header row `div` that shows `FileText` + page number (lines 378-399), add a "View page" button directly after the page span, before the closing `</div>` of that inner flex row:

```tsx
{source.page_start && docPublicUrl ? (
  <button
    type="button"
    onClick={() => setViewerPage(source.page_start!)}
    className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-primary/70 underline-offset-2 hover:text-primary hover:underline"
    title={language === "ms" ? "Lihat halaman asal" : "View source page"}
  >
    <ExternalLink className="h-2.5 w-2.5" />
    {language === "ms" ? "lihat" : "view"}
  </button>
) : null}
```

The exact insertion point is inside the `<div className="flex items-center gap-1.5 text-xs text-muted-foreground">` block (line 382), after the closing `</span>` of the page label (line 396).

- [ ] **Step 4: Pass `docPublicUrl` from ChatPanel**

In `frontend/components/chat-panel/index.tsx`, update the `AIMessageCard` call (lines 1198-1206):

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
/>
```

`selectedDoc` is already in scope in ChatPanel.

- [ ] **Step 5: Verify Dialog component exists**

```bash
ls frontend/components/ui/dialog.tsx
```

Expected: file exists (it's already imported elsewhere in the project).

- [ ] **Step 6: Build check**

```bash
cd frontend
pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors. The build may warn about other things but should not error on the new props.

- [ ] **Step 7: Manual smoke test**

1. `pnpm dev` in `frontend/`
2. Open `http://localhost:3000/workspace`
3. Select a document that has `public_url` set (featured docs: MyKad FAQ or Passport Guidelines)
4. Ask any question — e.g. "What documents do I need?"
5. Expand sources
6. Confirm "view" link appears next to page number on each source
7. Click "view" — Dialog should open showing the PDF at that page
8. Close dialog with × or Escape

If `public_url` is `null` for the selected doc, "view" link won't appear (correct behaviour — the `docPublicUrl &&` guard handles it).

- [ ] **Step 8: Commit**

```bash
git add frontend/components/chat-panel/message-cards.tsx frontend/components/chat-panel/index.tsx
git commit -m "feat: add inline PDF page viewer to source citations"
```

---

## Self-Review

**Spec coverage:**
- ✅ Batched embeddings: Task 1 replaces per-variant embed loop with single batch call
- ✅ Persistent eval (load on startup): Task 2 adds `load_fn`, wires Supabase query, swallows failures
- ✅ Inline PDF viewer: Task 3 adds Dialog + iframe + "view" button, threads `docPublicUrl`

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `docPublicUrl?: string` — defined in Task 3 step 1, used in steps 2, 3, 4
- `load_fn: Optional[Callable[[], list[dict]]]` — defined in step 3, wired in step 5
- `variant_texts` / `embeddings` — defined and consumed within same Task 1 function
