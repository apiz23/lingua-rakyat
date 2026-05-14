# Do-Now Improvements — Design Spec
**Date:** 2026-05-14  
**Scope:** Three targeted improvements: batched embeddings, persistent eval, inline PDF viewer

---

## 1. Batched Query-Variant Embeddings

### Problem
`_retrieve_matches` (rag_pipeline.py:876-882) calls `get_embeddings_cohere([single_text])` once per query variant inside a loop. With up to 4 variants, this is 4 sequential HTTP roundtrips to Cohere before any Pinecone query starts. Each call takes ~150-300ms, so up to 1.2s wasted on embedding alone.

### Design
Collect all variant texts first, call `get_embeddings_cohere(all_texts, input_type="search_query")` once, zip results back to variants. Then run Pinecone queries in sequence (Pinecone queries are already fast; no need to parallelise them for now).

**Change surface:** `_retrieve_matches` in `rag_pipeline.py` only.  
**Risk:** Low. Cohere batch embed supports up to 96 texts. Max variants = 4.  
**Expected gain:** ~600-900ms reduction in retrieval latency for augmented queries.

---

## 2. Persistent Eval Records (Load from Supabase on Startup)

### Problem
`Evaluator.__init__` starts with empty `_records`. The `persist_fn` already writes each record to Supabase `lr_eval_records` table on insert, but nothing loads them back after restart. The health check shows 0 records. The `/eval/report` endpoint shows empty metrics.

### Design
Add a `load_fn: Optional[Callable[[], list[dict]]]` parameter to `Evaluator.__init__`. If provided, call it at init time and populate `_records`. In `eval.py`, pass a `_load_eval_records` function that queries Supabase for the last N records (cap at 1000 to avoid memory bloat).

**Supabase query:** `SELECT * FROM lr_eval_records ORDER BY timestamp DESC LIMIT 1000`

The table already exists (created by prior migration). No schema changes needed.

**Change surface:** `utils/evaluation.py` (Evaluator.__init__), `routers/eval.py` (add load fn).  
**Risk:** Low. Load is read-only; failures should be swallowed with a warning (don't crash startup).

---

## 3. Inline PDF Page Viewer

### Problem
Source citations in `message-cards.tsx` show text snippets with page numbers but no way to see the actual PDF page. For judges and citizens, seeing the original source page is a trust signal. `Document.public_url` is already stored in Supabase.

### Design
Add a "View page" icon button to each source citation chip. Clicking opens a `<Dialog>` (shadcn/ui, already imported) containing:

1. **If `public_url` is available:** Render the PDF at the specific page using an `<iframe src="{public_url}#page={page_start}">`. Native browser PDF rendering — no new dependencies.
2. **Fallback:** Show the full text excerpt in a styled readable view.

The `public_url` is on the `Document` object but not on `SourceChunk`. Two approaches:
- **Option A (recommended):** Pass `document.public_url` down from ChatPanel → AIMessageCard → source citation. Only one extra prop thread.
- **Option B:** Add a `getDocumentById` API call in the dialog. Extra network request, worse UX.

**Go with Option A.** The `ChatPanel` already has `selectedDoc` which has `public_url`. Thread it into `AIMessageCard` via new optional prop `docPublicUrl?: string`.

**Change surface:**  
- `frontend/components/chat-panel/message-cards.tsx` — add dialog + view button to source citation  
- `frontend/components/chat-panel/index.tsx` — pass `docPublicUrl` to `AIMessageCard`

**Risk:** Medium. `<iframe>` PDF rendering varies by browser (Chrome: good, Firefox: good, Safari: good). Mobile: some browsers open in new tab instead of inline. Acceptable for a demo booth (desktop primary target).

---

## Summary

| # | Change | Files | Risk |
|---|--------|-------|------|
| 1 | Batch embeddings | `backend/utils/rag_pipeline.py` | Low |
| 2 | Load eval from Supabase | `backend/utils/evaluation.py`, `backend/routers/eval.py` | Low |
| 3 | Inline PDF viewer | `frontend/components/chat-panel/message-cards.tsx`, `frontend/components/chat-panel/index.tsx` | Medium |
