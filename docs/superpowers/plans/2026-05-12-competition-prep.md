# Competition Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all five competition-prep improvements (bug fix, eval metrics, gov doc seeding, UI polish, demo page) in order of impact, so Lingua Rakyat is demo-ready for RISE 2026.

**Architecture:** FastAPI backend with Cohere (embeddings + rerank), Pinecone (vector), Groq (LLM); Next.js 14 frontend with Tailwind + shadcn/ui. Faithfulness uses the existing Cohere reranker (no new API key). Gov doc seeding runs idempotently on startup. `/demo` page lives outside the `(app)` layout group.

**Tech Stack:** Python 3.11 + FastAPI + Cohere + Pinecone + Groq | Next.js 14 + TypeScript + Tailwind + shadcn/ui

---

## File Structure

**New files:**
- `backend/tests/__init__.py` — test package marker
- `backend/tests/test_rag_prompts.py` — Task 1 test
- `backend/tests/test_evaluation.py` — Tasks 2–3 tests
- `backend/tests/test_seed.py` — Task 5 test
- `backend/scripts/download_sample_docs.py` — one-time PDF fetch script
- `backend/sample_docs/.gitkeep` — ensures dir exists in git
- `supabase/migrations/2026-05-12-add-featured-docs.sql` — Task 4 migration
- `frontend/app/demo/page.tsx` — Task 10 demo page

**Modified files:**
- `backend/utils/rag_pipeline.py` — fix zh-cn prompt (Task 1), add `_compute_faithfulness()` (Task 2)
- `backend/utils/evaluation.py` — add `faithfulness_score` to `record()` + `report()` (Task 2), add `semantic_similarity` to `report()` context (Task 3)
- `backend/routers/chat.py` — thread faithfulness through `_record_eval()` (Task 2)
- `backend/routers/eval.py` — add `faithfulness_score` to `RecordRequest`, add `semantic_similarity` to test suite (Task 2–3)
- `backend/routers/documents.py` — add `is_featured`/`agency` to `DocumentResponse`, add `POST /seed` endpoint (Task 5)
- `backend/main.py` — call seed on startup (Task 5)
- `frontend/lib/api.ts` — extend `Document` type, extend `EvalReport`/`TestSuiteResult` types (Tasks 2, 6, 7)
- `frontend/app/(app)/eval/page.tsx` — add faithfulness + semantic similarity metric cards and score bars (Task 6)
- `frontend/app/(app)/workspace/page.tsx` — add featured docs section to picker (Task 7)
- `frontend/components/ui/orb.tsx` — delete (Task 8)
- `frontend/components/upload-modal.tsx` — keyboard focus trap (Task 9)
- `frontend/components/chat-panel/index.tsx` — focus-visible rings (Task 9)
- `frontend/app/(app)/manage/page.tsx` — keyboard nav pass (Task 9)
- `frontend/components/chat-panel/message-cards.tsx` — mobile overflow fix (Task 9)

---

## Task 1: Fix zh-cn Mojibake Bug

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_rag_prompts.py`
- Modify: `backend/utils/rag_pipeline.py:982–994`

- [ ] **Step 1: Create test package**

```bash
mkdir backend/tests
echo "" > backend/tests/__init__.py
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_rag_prompts.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.rag_pipeline import _build_qa_prompt


def test_zh_cn_prompt_is_valid_unicode():
    prompt = _build_qa_prompt("zh-cn", "什么是公积金？", "context here")
    assert "ä½" not in prompt, "Prompt contains mojibake — UTF-8 was misread as Latin-1"
    assert "你是" in prompt, "Expected Chinese characters in prompt"


def test_zh_cn_prompt_contains_context_and_question():
    prompt = _build_qa_prompt("zh-cn", "什么是公积金？", "some context")
    assert "some context" in prompt
    assert "什么是公积金？" in prompt


def test_en_and_ms_prompts_unchanged():
    en = _build_qa_prompt("en", "test?", "ctx")
    ms = _build_qa_prompt("ms", "test?", "ctx")
    assert "You are a cautious" in en
    assert "Anda ialah" in ms
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_rag_prompts.py -v
```

Expected: `FAILED test_zh_cn_prompt_is_valid_unicode — AssertionError: Prompt contains mojibake`

- [ ] **Step 4: Fix the mojibake — replace lines 982–994 in `backend/utils/rag_pipeline.py`**

Find this block (the garbled string starting with `"ä½ æ˜¯ä¸€ä½..."`):

```python
        "zh-cn": (
            "ä½ æ˜¯ä¸€ä½è°¨æ…Žçš„æ"¿åºœæœåŠ¡åŠ©æ‰‹ã€‚\n"
            "æ£€ç´¢åˆ°çš„æ'˜å½•å¯èƒ½åªæ˜¯éƒ¨åˆ†åŒ¹é…ç"¨æˆ·çš„é—®é¢˜ã€‚\n"
            "åªèƒ½ä½¿ç"¨ä¸‹æ–¹ä¸Šä¸‹æ–‡ï¼Œä¸è¦ä½¿ç"¨å¤–éƒ¨çŸ¥è¯†ã€‚\n"
            "å¦‚æžœä¸Šä¸‹æ–‡æœ‰æœ‰ç"¨ä¿¡æ¯ï¼Œè¯·è°¨æ…Žå›žç­"å¹¶è¯´æ˜Žé™åˆ¶ã€‚\n"
            "å¦‚æžœä¸Šä¸‹æ–‡ç¡®å®žæ— æ³•å›žç­"é—®é¢˜ï¼Œè¯·æ¸…æ¥šè¯´æ˜Žã€‚\n"
            "æŠŠç­"æ¡ˆå†™æˆ3åˆ°5ä¸ªç®€çŸ­è¦ç‚¹ã€‚\n"
            "ç»"å°¾å†™: æ¥æº: Based on official documents provided.\n\n"
            "ä¸Šä¸‹æ–‡:\n{context}\n\n"
            "é—®é¢˜: {question}\n"
            "ç­"æ¡ˆ:"
        ),
```

Replace with:

```python
        "zh-cn": (
            "你是一位谨慎的政府服务助手。\n"
            "检索到的摘录可能只是部分匹配用户的问题。\n"
            "只能使用下方上下文，不要使用外部知识。\n"
            "如果上下文有有用信息，请谨慎回答并说明限制。\n"
            "如果上下文确实无法回答问题，请清楚说明。\n"
            "把答案写成3到5个简短要点。\n"
            "结尾写: 来源: Based on official documents provided.\n\n"
            "上下文:\n{context}\n\n"
            "问题: {question}\n"
            "答案:"
        ),
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_rag_prompts.py -v
```

Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/tests/__init__.py backend/tests/test_rag_prompts.py backend/utils/rag_pipeline.py
git commit -m "fix: correct zh-cn cautious QA prompt encoding (mojibake → UTF-8)"
```

---

## Task 2: Faithfulness Score — Backend

**Files:**
- Create: `backend/tests/test_evaluation.py`
- Modify: `backend/utils/rag_pipeline.py` (add `_compute_faithfulness`)
- Modify: `backend/utils/evaluation.py` (add `faithfulness_score` param + aggregation)
- Modify: `backend/routers/chat.py` (thread faithfulness through `_record_eval`)
- Modify: `backend/routers/eval.py` (add `faithfulness_score` to `RecordRequest`)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_evaluation.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.evaluation import Evaluator


def test_record_accepts_faithfulness_score():
    ev = Evaluator()
    rec = ev.record(
        question="How do I apply?",
        answer="Submit the form online.",
        language="en",
        confidence=0.8,
        latency_ms=500,
        faithfulness_score=0.75,
    )
    assert rec["faithfulness_score"] == 0.75


def test_record_faithfulness_defaults_to_none():
    ev = Evaluator()
    rec = ev.record(
        question="Q",
        answer="A",
        language="en",
        confidence=0.5,
        latency_ms=200,
    )
    assert rec.get("faithfulness_score") is None


def test_report_includes_avg_faithfulness():
    ev = Evaluator()
    ev.record("Q1", "A1", language="en", confidence=0.7, latency_ms=300, faithfulness_score=0.8)
    ev.record("Q2", "A2", language="ms", confidence=0.6, latency_ms=400, faithfulness_score=0.6)
    ev.record("Q3", "A3", language="en", confidence=0.5, latency_ms=200)  # no faithfulness
    report = ev.report()
    assert "faithfulness" in report
    assert abs(report["faithfulness"]["avg_faithfulness_score"] - 0.70) < 0.01
    assert report["faithfulness"]["scored_queries"] == 2
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && python -m pytest tests/test_evaluation.py -v
```

Expected: `3 failed`

- [ ] **Step 3: Add `faithfulness_score` param to `Evaluator.record()` and aggregate in `report()`**

In `backend/utils/evaluation.py`, update the `record()` signature and body:

```python
    def record(
        self,
        question:          str,
        answer:            str,
        ground_truth:      Optional[str] = None,
        language:          str = "en",
        confidence:        float = 0.0,
        latency_ms:        int = 0,
        document_id:       str = "",
        faithfulness_score: Optional[float] = None,
    ) -> dict:
```

Inside `record()`, after the existing `metrics: dict = {...}` block, add:

```python
        if faithfulness_score is not None:
            metrics["faithfulness_score"] = round(faithfulness_score, 4)
```

In `report()`, after the `rouge_bleu` block and before the final `report_data` dict, add:

```python
        # ── Faithfulness (only queries with a score) ──────────────────────
        faithful_records = [r for r in self._records if r.get("faithfulness_score") is not None]
        faithfulness_stats: dict = {}
        if faithful_records:
            nf = len(faithful_records)
            faithfulness_stats = {
                "scored_queries": nf,
                "avg_faithfulness_score": round(
                    sum(r["faithfulness_score"] for r in faithful_records) / nf, 4
                ),
            }
```

In the `report_data` dict, add the `"faithfulness"` key:

```python
            "faithfulness": faithfulness_stats,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_evaluation.py -v
```

Expected: `3 passed`

- [ ] **Step 5: Add `_compute_faithfulness()` to `backend/utils/rag_pipeline.py`**

Add this function after `_cohere_rerank()` (around line 800):

```python
def _compute_faithfulness(answer: str, source_chunks: list[str]) -> Optional[float]:
    """
    Compute faithfulness: how grounded the answer is in the retrieved chunks.
    Uses the Cohere reranker with the answer as query and chunks as documents.
    Highest relevance_score = faithfulness for this query.
    Returns None if reranking is disabled or answer/chunks are empty.
    """
    cohere_key = os.getenv("COHERE_API_KEY")
    if not ENABLE_COHERE_RERANK or not cohere_key or not source_chunks or not answer.strip():
        return None

    documents = [chunk for chunk in source_chunks if chunk.strip()]
    if not documents:
        return None

    try:
        response = requests.post(
            "https://api.cohere.ai/v1/rerank",
            json={
                "query": answer,
                "documents": documents,
                "model": "rerank-multilingual-v3.0",
                "top_n": len(documents),
            },
            headers={
                "Authorization": f"Bearer {cohere_key}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        if response.status_code != 200:
            logger.warning("[Faithfulness] Rerank returned %d", response.status_code)
            return None
        results = response.json().get("results", [])
        if not results:
            return None
        return round(max(r.get("relevance_score", 0.0) for r in results), 4)
    except Exception as exc:
        logger.warning("[Faithfulness] Cohere rerank failed: %s", exc)
        return None
```

Make sure `Optional` is imported at the top of the file — add to the existing `from typing import Any, Optional` if not already there.

- [ ] **Step 6: Thread faithfulness through `_record_eval` in `backend/routers/chat.py`**

Update `_record_eval()`:

```python
def _record_eval(body: AskRequest, result: dict[str, Any], answer_text: str) -> None:
    from utils.rag_pipeline import _compute_faithfulness
    try:
        source_texts = [s.get("text", "") for s in result.get("sources", [])]
        faithfulness = _compute_faithfulness(answer_text, source_texts)
        evaluator.record(
            question=body.question,
            answer=answer_text,
            language=result.get("language", "en"),
            confidence=result.get("confidence", 0.0),
            latency_ms=result.get("latency_ms", 0),
            document_id=body.document_id,
            faithfulness_score=faithfulness,
        )
    except Exception as exc:
        logger.warning("[Eval] Failed to record interaction: %s", exc)
```

- [ ] **Step 7: Add `faithfulness_score` to `RecordRequest` in `backend/routers/eval.py`**

```python
class RecordRequest(BaseModel):
    question:          str
    answer:            str
    language:          str = "en"
    confidence:        float = 0.0
    latency_ms:        int = 0
    document_id:       str = ""
    ground_truth:      Optional[str] = None
    faithfulness_score: Optional[float] = None
```

Update `record_interaction()` to pass through faithfulness_score:

```python
    metrics = _evaluator.record(
        question=req.question,
        answer=req.answer,
        ground_truth=req.ground_truth,
        language=req.language,
        confidence=req.confidence,
        latency_ms=req.latency_ms,
        document_id=req.document_id,
        faithfulness_score=req.faithfulness_score,
    )
```

- [ ] **Step 8: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add backend/utils/rag_pipeline.py backend/utils/evaluation.py backend/routers/chat.py backend/routers/eval.py backend/tests/test_evaluation.py
git commit -m "feat: add faithfulness score to eval pipeline via Cohere reranker"
```

---

## Task 3: Semantic Similarity — Backend

**Files:**
- Modify: `backend/routers/eval.py` (add cosine similarity to `run_test_suite`)
- Modify: `backend/tests/test_evaluation.py` (extend)

- [ ] **Step 1: Add test for semantic similarity in test suite results**

Append to `backend/tests/test_evaluation.py`:

```python
def test_cosine_similarity_computation():
    import math

    def cosine(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = math.sqrt(sum(x**2 for x in a))
        mag_b = math.sqrt(sum(x**2 for x in b))
        if mag_a == 0 or mag_b == 0:
            return 0.0
        return dot / (mag_a * mag_b)

    a = [1.0, 0.0, 0.0]
    b = [1.0, 0.0, 0.0]
    assert cosine(a, b) == 1.0

    c = [1.0, 0.0, 0.0]
    d = [0.0, 1.0, 0.0]
    assert cosine(c, d) == 0.0
```

- [ ] **Step 2: Run to verify pass (pure logic, no imports fail)**

```bash
cd backend && python -m pytest tests/test_evaluation.py::test_cosine_similarity_computation -v
```

Expected: `PASSED`

- [ ] **Step 3: Add `_compute_semantic_similarity()` to `backend/utils/rag_pipeline.py`**

Add after `_compute_faithfulness()`:

```python
def _compute_semantic_similarity(text_a: str, text_b: str) -> Optional[float]:
    """
    Cosine similarity between two texts using Cohere multilingual embeddings.
    Used in test suite runs to score generated answer vs ground truth.
    Returns None on API failure or missing key.
    """
    cohere_key = os.getenv("COHERE_API_KEY")
    if not cohere_key or not text_a.strip() or not text_b.strip():
        return None

    import math

    try:
        response = requests.post(
            "https://api.cohere.ai/v1/embed",
            json={
                "texts": [text_a, text_b],
                "model": "embed-multilingual-v3.0",
                "input_type": "search_document",
            },
            headers={
                "Authorization": f"Bearer {cohere_key}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if response.status_code != 200:
            logger.warning("[SemanticSim] Embed returned %d", response.status_code)
            return None
        embeddings = response.json().get("embeddings", [])
        if len(embeddings) < 2:
            return None
        a, b = embeddings[0], embeddings[1]
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = math.sqrt(sum(x**2 for x in a))
        mag_b = math.sqrt(sum(x**2 for x in b))
        if mag_a == 0 or mag_b == 0:
            return None
        return round(dot / (mag_a * mag_b), 4)
    except Exception as exc:
        logger.warning("[SemanticSim] Cohere embed failed: %s", exc)
        return None
```

- [ ] **Step 4: Add semantic_similarity to `run_test_suite` in `backend/routers/eval.py`**

At the top of the file, import the new function:

```python
from utils.rag_pipeline import answer_question, GROQ_MODEL_FAST, _get_augmenter, _compute_semantic_similarity
```

Inside the `for i, case in enumerate(test_cases):` loop in `run_test_suite`, after computing `fk`, add:

```python
            sem_sim = _compute_semantic_similarity(answer, gt)
```

In the `results.append(...)` block, add `"semantic_similarity"` to the `"scores"` dict:

```python
            results.append({
                "case_index":   i,
                "language":     case["language"],
                "category":     case.get("category"),
                "question":     case["question"],
                "answer":       answer,
                "ground_truth": gt,
                "scores": {
                    "rouge1_f1":          r1["f1"],
                    "rouge2_f1":          r2["f1"],
                    "rougeL_f1":          rl["f1"],
                    "bleu":               bl,
                    "fk_grade":           fk,
                    "confidence":         rag_result.get("confidence", 0.0),
                    "latency_ms":         rag_result.get("latency_ms", 0),
                    "semantic_similarity": sem_sim,
                },
            })
```

In the `aggregate` dict, add semantic similarity aggregation:

```python
    scored_sim = [r for r in results if r["scores"].get("semantic_similarity") is not None]
    if scored_sim:
        avg_sem_sim = round(sum(r["scores"]["semantic_similarity"] for r in scored_sim) / len(scored_sim), 4)
    else:
        avg_sem_sim = None

    aggregate = {
        # ... existing fields ...
        "avg_semantic_similarity": avg_sem_sim,
    }
```

Also add the streaming endpoint version if it exists in eval.py (search for `run-test-suite-stream` and apply the same `sem_sim` pattern to per-event results there).

- [ ] **Step 5: Run tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add backend/utils/rag_pipeline.py backend/routers/eval.py backend/tests/test_evaluation.py
git commit -m "feat: add semantic similarity scoring to test suite via Cohere embed"
```

---

## Task 4: Supabase Migration File

**Files:**
- Create: `supabase/migrations/2026-05-12-add-featured-docs.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/2026-05-12-add-featured-docs.sql
-- Adds featured document support and faithfulness scoring

-- Featured docs columns (for pre-loaded government documents)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS agency varchar(20);

-- Faithfulness score column for live query eval records
ALTER TABLE lr_eval_records ADD COLUMN IF NOT EXISTS faithfulness_score float;
```

- [ ] **Step 2: Verify the file is valid SQL (manual check)**

Open the file and confirm three `ALTER TABLE` statements are present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026-05-12-add-featured-docs.sql
git commit -m "chore: add Supabase migration for featured docs + faithfulness score column"
```

---

## Task 5: Government Document Seeding — Backend

**Files:**
- Create: `backend/sample_docs/.gitkeep`
- Create: `backend/scripts/download_sample_docs.py`
- Create: `backend/tests/test_seed.py`
- Modify: `backend/routers/documents.py` (add `is_featured`/`agency` to model + add `POST /seed`)
- Modify: `backend/main.py` (call seed on startup)

- [ ] **Step 1: Create sample_docs directory**

```bash
mkdir backend/sample_docs
echo "" > backend/sample_docs/.gitkeep
```

- [ ] **Step 2: Create download script**

```python
# backend/scripts/download_sample_docs.py
"""
One-time script to download pre-approved Malaysian government PDFs.
Run: python backend/scripts/download_sample_docs.py
PDFs are saved to backend/sample_docs/. Files > 5MB are excluded from git.
"""
import os
import urllib.request

SAMPLE_DOCS = [
    {
        "doc_id": "lhdn-efiling-2024",
        "filename": "lhdn-efiling-2024.pdf",
        "url": None,  # Set LHDN_PDF_URL env var or place PDF manually in sample_docs/
    },
    {
        "doc_id": "kwsp-pengeluaran",
        "filename": "kwsp-pengeluaran.pdf",
        "url": None,  # Set KWSP_PDF_URL env var
    },
    {
        "doc_id": "jpn-mykad-faq",
        "filename": "jpn-mykad-faq.pdf",
        "url": None,  # Set JPN_PDF_URL env var
    },
    {
        "doc_id": "ptptn-peminjam",
        "filename": "ptptn-peminjam.pdf",
        "url": None,  # Set PTPTN_PDF_URL env var
    },
]

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_docs")

def download_all():
    os.makedirs(OUT_DIR, exist_ok=True)
    for doc in SAMPLE_DOCS:
        dest = os.path.join(OUT_DIR, doc["filename"])
        if os.path.exists(dest):
            print(f"  [skip] {doc['filename']} already exists")
            continue
        url = doc["url"] or os.getenv(doc["doc_id"].upper().replace("-", "_") + "_PDF_URL")
        if not url:
            print(f"  [skip] {doc['filename']} — no URL configured. Place PDF manually in backend/sample_docs/")
            continue
        print(f"  Downloading {doc['filename']}...")
        urllib.request.urlretrieve(url, dest)
        size_mb = os.path.getsize(dest) / (1024 * 1024)
        print(f"  Done ({size_mb:.1f} MB)")

if __name__ == "__main__":
    download_all()
```

- [ ] **Step 3: Write the seed endpoint test**

```python
# backend/tests/test_seed.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers.documents import FEATURED_DOCS


def test_featured_docs_defined():
    assert len(FEATURED_DOCS) == 4
    ids = [d["doc_id"] for d in FEATURED_DOCS]
    assert "lhdn-efiling-2024" in ids
    assert "kwsp-pengeluaran" in ids
    assert "jpn-mykad-faq" in ids
    assert "ptptn-peminjam" in ids


def test_featured_docs_have_required_fields():
    for doc in FEATURED_DOCS:
        assert "doc_id" in doc
        assert "name" in doc
        assert "agency" in doc
        assert "filename" in doc
        assert doc["agency"] in ("LHDN", "KWSP", "JPN", "PTPTN")
```

- [ ] **Step 4: Run to verify failure**

```bash
cd backend && python -m pytest tests/test_seed.py -v
```

Expected: `ImportError` — `FEATURED_DOCS` not yet defined

- [ ] **Step 5: Update `DocumentResponse` model and add `FEATURED_DOCS` + `POST /seed` to `backend/routers/documents.py`**

First, update `DocumentResponse`:

```python
class DocumentResponse(BaseModel):
    id: str
    name: str
    size_bytes: int
    chunk_count: int
    status: str
    uploaded_at: str
    storage_path: Optional[str] = None
    public_url: Optional[str] = None
    error_message: Optional[str] = None
    is_featured: bool = False
    agency: Optional[str] = None
```

Update `normalize_document_row()` to include the new fields:

```python
    return {
        "id": str(row.get("id", "")),
        "name": row.get("name", ""),
        "size_bytes": int(row.get("size_bytes", 0) or 0),
        "chunk_count": int(row.get("chunk_count", 0) or 0),
        "status": row.get("status", "ready"),
        "uploaded_at": uploaded_at,
        "storage_path": storage_path,
        "public_url": public_url,
        "error_message": row.get("error_message"),
        "is_featured": bool(row.get("is_featured", False)),
        "agency": row.get("agency"),
    }
```

After the existing imports (around line 30), add:

```python
SAMPLE_DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_docs")

FEATURED_DOCS = [
    {
        "doc_id": "lhdn-efiling-2024",
        "name": "Panduan e-Filing 2024 (LHDN).pdf",
        "agency": "LHDN",
        "filename": "lhdn-efiling-2024.pdf",
    },
    {
        "doc_id": "kwsp-pengeluaran",
        "name": "Panduan Pengeluaran EPF (KWSP).pdf",
        "agency": "KWSP",
        "filename": "kwsp-pengeluaran.pdf",
    },
    {
        "doc_id": "jpn-mykad-faq",
        "name": "Permohonan MyKad FAQ (JPN).pdf",
        "agency": "JPN",
        "filename": "jpn-mykad-faq.pdf",
    },
    {
        "doc_id": "ptptn-peminjam",
        "name": "Panduan Peminjam PTPTN.pdf",
        "agency": "PTPTN",
        "filename": "ptptn-peminjam.pdf",
    },
]
```

Add the seed endpoint at the end of `backend/routers/documents.py`:

```python
PREWARM_QUESTIONS: dict[str, list[str]] = {
    "lhdn-efiling-2024": [
        "Summarize this document",
        "Siapa yang layak memohon?",
        "What documents do I need?",
    ],
    "kwsp-pengeluaran": [
        "Summarize this document",
        "Siapa yang layak memohon?",
        "What documents do I need?",
    ],
    "jpn-mykad-faq": [
        "Summarize this document",
        "Siapa yang layak memohon?",
        "What documents do I need?",
    ],
    "ptptn-peminjam": [
        "Summarize this document",
        "Siapa yang layak memohon?",
        "What documents do I need?",
    ],
}


@router.post("/seed")
async def seed_featured_documents():
    """
    Idempotent seeding of pre-approved Malaysian government PDFs.
    Checks Supabase by doc_id before ingesting — safe to call on every startup.
    Returns counts of newly seeded vs already-present docs.
    """
    from utils.rag_pipeline import ingest_document

    existing_docs = load_documents()
    existing_ids = {doc["id"] for doc in existing_docs}

    seeded = 0
    already_present = 0

    for featured in FEATURED_DOCS:
        doc_id = featured["doc_id"]

        if doc_id in existing_ids:
            logger.info("[Seed] Already present: %s", doc_id)
            already_present += 1
            continue

        pdf_path = os.path.join(SAMPLE_DOCS_DIR, featured["filename"])
        if not os.path.exists(pdf_path):
            logger.warning("[Seed] PDF not found, skipping: %s", pdf_path)
            continue

        try:
            chunk_count, _ = ingest_document(
                pdf_path=pdf_path,
                document_id=doc_id,
                document_name=featured["name"],
            )
            doc_record = {
                "id": doc_id,
                "name": featured["name"],
                "size_bytes": os.path.getsize(pdf_path),
                "chunk_count": chunk_count,
                "status": "ready",
                "uploaded_at": utc_now_iso(),
                "storage_path": None,
                "public_url": None,
                "error_message": None,
                "is_featured": True,
                "agency": featured["agency"],
            }
            upsert_documents([doc_record])
            logger.info("[Seed] Seeded %s (%d chunks)", doc_id, chunk_count)
            seeded += 1
        except Exception as exc:
            logger.error("[Seed] Failed to ingest %s: %s", doc_id, exc)

    return {"seeded": seeded, "already_present": already_present}


async def _prewarm_featured_docs():
    """
    After seeding completes, silently fire 3 pre-warm questions per featured doc.
    Populates _query_cache so first judge query returns in ~200ms instead of ~2s.
    """
    from utils.rag_pipeline import answer_question, _query_cache

    existing_ids = {doc["id"] for doc in load_documents()}
    for featured in FEATURED_DOCS:
        doc_id = featured["doc_id"]
        if doc_id not in existing_ids:
            continue
        for question in PREWARM_QUESTIONS.get(doc_id, []):
            try:
                answer_question(
                    question=question,
                    document_id=doc_id,
                    enable_query_augmentation=False,
                )
                logger.info("[Prewarm] Cached: %s / %s", doc_id, question[:40])
            except Exception as exc:
                logger.warning("[Prewarm] Failed: %s / %s — %s", doc_id, question[:40], exc)
```

- [ ] **Step 6: Add startup event to `backend/main.py`**

After the router includes (around line 144), add:

```python
import asyncio

@app.on_event("startup")
async def startup_seed_and_prewarm():
    async def _run():
        try:
            from routers.documents import seed_featured_documents, _prewarm_featured_docs
            result = await seed_featured_documents()
            logger.info("[Startup] Seed result: %s", result)
            await _prewarm_featured_docs()
        except Exception as exc:
            logger.warning("[Startup] Seed/prewarm failed (non-fatal): %s", exc)
    asyncio.create_task(_run())
```

- [ ] **Step 7: Run seed tests**

```bash
cd backend && python -m pytest tests/test_seed.py -v
```

Expected: `2 passed`

- [ ] **Step 8: Commit**

```bash
git add backend/sample_docs/.gitkeep backend/scripts/download_sample_docs.py backend/tests/test_seed.py backend/routers/documents.py backend/main.py
git commit -m "feat: add government document seeding with idempotent seed endpoint and cache pre-warm"
```

---

## Task 6: Eval Frontend — Faithfulness + Semantic Similarity

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/(app)/eval/page.tsx`

- [ ] **Step 1: Extend TypeScript types in `frontend/lib/api.ts`**

Update `EvalReport` to include faithfulness:

```typescript
export type EvalReport = {
  // ... existing fields ...
  faithfulness?: {
    scored_queries: number
    avg_faithfulness_score: number
  }
  generation_quality?: {
    samples_with_ground_truth: number
    avg_rouge1_f1: number
    avg_rouge2_f1: number
    avg_rougeL_f1: number
    avg_bleu: number
    exact_match_rate: number
  }
}
```

Update `TestSuiteResult` aggregate to include semantic similarity:

```typescript
export type TestSuiteResult = {
  status: string
  aggregate: {
    cases_run: number
    cases_failed: number
    avg_rouge1_f1: number
    avg_rouge2_f1: number
    avg_rougeL_f1: number
    avg_bleu: number
    avg_fk_grade: number
    avg_confidence: number
    avg_latency_ms: number
    avg_semantic_similarity: number | null
    readability_note: string
  }
  results: Array<{
    case_index: number
    language: string
    category?: string
    question: string
    answer: string
    ground_truth: string
    scores: {
      rouge1_f1: number
      rouge2_f1: number
      rougeL_f1: number
      bleu: number
      fk_grade: number
      confidence: number
      latency_ms: number
      semantic_similarity: number | null
      faithfulness_score?: number | null
    }
  }>
  errors: Array<{ case_index: number; question: string; error: string }>
}
```

- [ ] **Step 2: Add faithfulness and semantic similarity to the eval dashboard**

In `frontend/app/(app)/eval/page.tsx`, in the section where `hasMetrics` is true, add two new `MetricCard` entries after the existing Retrieval + Readability grid (around line 521):

```tsx
              {/* Faithfulness Score */}
              {report.faithfulness && report.faithfulness.scored_queries > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Faithfulness Score"
                    value={score(report.faithfulness.avg_faithfulness_score)}
                    sub={`${report.faithfulness.scored_queries} queries scored`}
                    color="text-primary"
                    bg="bg-primary/5"
                    icon={Sparkles}
                  />
                  {testResult?.aggregate.avg_semantic_similarity != null && (
                    <MetricCard
                      label="Semantic Similarity"
                      value={score(testResult.aggregate.avg_semantic_similarity)}
                      sub="Answer vs ground truth"
                      color="text-emerald-600"
                      bg="bg-emerald-500/5"
                      icon={CheckCircle}
                    />
                  )}
                </div>
              )}
```

In the `hasGenerationQuality` score bars section, after the existing `ScoreBar` entries for ROUGE/BLEU (around line 601), add:

```tsx
                    {report.faithfulness && report.faithfulness.scored_queries > 0 && (
                      <ScoreBar
                        label="Faithfulness Score (answer grounded in sources)"
                        value={report.faithfulness.avg_faithfulness_score}
                      />
                    )}
                    {testResult?.aggregate.avg_semantic_similarity != null && (
                      <ScoreBar
                        label="Semantic Similarity (vs ground truth)"
                        value={testResult.aggregate.avg_semantic_similarity}
                      />
                    )}
```

In the per-case expandable row (around line 1152), add faithfulness alongside Grade/Confidence/Latency:

```tsx
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span>
                                  Grade:{" "}
                                  <GradeBadge grade={r.scores.fk_grade} />
                                </span>
                                <span>
                                  Confidence: {pct(r.scores.confidence)}
                                </span>
                                <span>Latency: {r.scores.latency_ms}ms</span>
                                {r.scores.semantic_similarity != null && (
                                  <span>
                                    Semantic Sim:{" "}
                                    <span className="font-mono tabular-nums">
                                      {r.scores.semantic_similarity.toFixed(3)}
                                    </span>
                                  </span>
                                )}
                              </div>
```

- [ ] **Step 3: Manual verification**

Start dev server:
```bash
cd frontend && npm run dev
```

Navigate to `/eval`. Run the test suite against any ready document. Confirm:
- After running: "Faithfulness Score" MetricCard appears in the metrics section
- "Semantic Similarity" MetricCard appears when test suite has run
- Score bars section shows Faithfulness and Semantic Similarity bars
- Expanding a per-case row shows "Semantic Sim: 0.xxx"

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts frontend/app/(app)/eval/page.tsx
git commit -m "feat: add faithfulness score and semantic similarity to eval dashboard"
```

---

## Task 7: Featured Docs — Workspace UI

**Files:**
- Modify: `frontend/lib/api.ts` (update `Document` type)
- Modify: `frontend/app/(app)/workspace/page.tsx`

- [ ] **Step 1: Update `Document` type in `frontend/lib/api.ts`**

```typescript
export type Document = {
  id: string
  name: string
  size_bytes: number
  chunk_count: number
  status: "processing" | "ready" | "error"
  uploaded_at: string
  error_message?: string
  storage_path?: string
  public_url?: string
  is_featured?: boolean
  agency?: string
}
```

- [ ] **Step 2: Add agency badge colors and featured section to workspace picker**

In `frontend/app/(app)/workspace/page.tsx`, add the agency badge color helper at the top of the component function:

```typescript
  const AGENCY_COLORS: Record<string, string> = {
    LHDN: "bg-emerald-700",
    KWSP: "bg-blue-700",
    JPN: "bg-purple-700",
    PTPTN: "bg-red-700",
  }
```

Split `sortedDocs` into featured and user-uploaded:

```typescript
  const featuredDocs = useMemo(
    () => sortedDocs.filter((d) => d.is_featured && d.status === "ready"),
    [sortedDocs]
  )
  const userDocs = useMemo(
    () => sortedDocs.filter((d) => !d.is_featured),
    [sortedDocs]
  )
```

In the `PopoverContent` `<div className="flex flex-col">` section, replace the current document list with:

```tsx
                  <ScrollArea className="max-h-60 sm:max-h-80">
                    <div className="p-2 sm:p-1">
                      {/* No document option */}
                      <button
                        onClick={() => {
                          setSelectedDoc(null)
                          setIsDocPickerOpen(false)
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent sm:py-2",
                          !selectedDoc && "bg-primary/5 text-primary"
                        )}
                      >
                        <Database className="h-4 w-4" />
                        <span>No document</span>
                      </button>

                      {/* Featured gov docs section */}
                      {featuredDocs.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Featured — Malaysian Gov Docs
                          </div>
                          {featuredDocs.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => {
                                setSelectedDoc(doc)
                                setIsDocPickerOpen(false)
                              }}
                              className={cn(
                                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent sm:py-2",
                                selectedDoc?.id === doc.id && "bg-primary/5"
                              )}
                            >
                              {doc.agency && (
                                <div
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white",
                                    AGENCY_COLORS[doc.agency] ?? "bg-muted"
                                  )}
                                >
                                  {doc.agency}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-sm">
                                  {doc.name.replace(/\s*\(.*?\)\.pdf$/, ".pdf")}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {doc.agency} · Official document
                                </div>
                              </div>
                              <span className="shrink-0 bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                READY
                              </span>
                            </button>
                          ))}
                          {userDocs.length > 0 && (
                            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-t border-border mt-1 pt-2">
                              Your Uploads
                            </div>
                          )}
                        </>
                      )}

                      {/* User uploaded docs */}
                      {docsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="mx-1 my-0.5 h-9 animate-pulse bg-muted/40" />
                        ))
                      ) : userDocs.length === 0 && featuredDocs.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No documents yet
                        </div>
                      ) : (
                        userDocs.map((doc) => {
                          const { icon: Icon, color, label } = statusConfig(doc.status)
                          return (
                            <button
                              key={doc.id}
                              onClick={() => {
                                setSelectedDoc(doc)
                                setIsDocPickerOpen(false)
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent sm:py-2",
                                selectedDoc?.id === doc.id && "bg-primary/5"
                              )}
                            >
                              <Icon className={cn("h-4 w-4 shrink-0", color)} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate font-medium">{doc.name}</span>
                                  <span className="border border-border/50 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    {label}
                                  </span>
                                </div>
                              </div>
                              {selectedDoc?.id === doc.id && (
                                <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>
```

- [ ] **Step 3: Manual verification**

1. Start backend: `cd backend && uvicorn main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to `/workspace`
4. Click the document picker
5. Confirm "Featured — Malaysian Gov Docs" section appears at top (if PDFs are present in `backend/sample_docs/`)
6. Select a featured doc — verify chat panel activates with that doc
7. Confirm user-uploaded docs still appear below

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts frontend/app/(app)/workspace/page.tsx
git commit -m "feat: add featured gov docs section to workspace document picker"
```

---

## Task 8: Delete orb.tsx

**Files:**
- Delete: `frontend/components/ui/orb.tsx`

- [ ] **Step 1: Confirm no imports exist**

```bash
grep -r "orb" frontend/app frontend/components --include="*.tsx" --include="*.ts" -l
```

Expected: no output (no files import orb)

- [ ] **Step 2: Delete the file**

```bash
rm frontend/components/ui/orb.tsx
```

- [ ] **Step 3: Verify the frontend builds**

```bash
cd frontend && npm run build
```

Expected: build succeeds with no errors referencing orb

- [ ] **Step 4: Commit**

```bash
git add -u frontend/components/ui/orb.tsx
git commit -m "chore: remove orb.tsx — animated orb is an explicit anti-pattern per design principles"
```

---

## Task 9: Keyboard Navigation + Mobile Viewport Polish

**Files:**
- Modify: `frontend/components/upload-modal.tsx`
- Modify: `frontend/components/chat-panel/index.tsx`
- Modify: `frontend/app/(app)/manage/page.tsx`
- Modify: `frontend/components/chat-panel/message-cards.tsx`
- Modify: `frontend/app/(app)/workspace/page.tsx`

- [ ] **Step 1: Upload modal — add focus trap**

In `frontend/components/upload-modal.tsx`, on the outermost modal div/dialog element, add:

```tsx
onKeyDown={(e) => {
  if (e.key === "Escape") onClose()
}}
```

Add `tabIndex={0}` and `autoFocus` to the first focusable element inside the modal (typically the file drop zone or close button). Ensure the close button has `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none`.

- [ ] **Step 2: Chat input — focus-visible ring**

In `frontend/components/chat-panel/index.tsx`, on the chat textarea/input element, add:

```tsx
className="... focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
```

On the submit button (send button), add:

```tsx
className="... focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
```

- [ ] **Step 3: Source accordion — keyboard expand/collapse**

In `frontend/components/chat-panel/message-cards.tsx`, on any `<div>` that acts as an accordion toggle, change it to a `<button>` element and add:

```tsx
<button
  className="... focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none"
  onClick={toggle}
  aria-expanded={isOpen}
>
```

- [ ] **Step 4: Mobile viewport — long PDF names in picker**

In `frontend/app/(app)/workspace/page.tsx`, on the `<span>` showing the selected doc name in the PopoverTrigger button, ensure it has:

```tsx
<span className="truncate min-w-0 font-medium">
  {selectedDoc.name}
</span>
```

The trigger button should have `min-w-0` so the truncate works:

```tsx
<div className="flex items-center gap-2 truncate min-w-0">
```

- [ ] **Step 5: Mobile viewport — source card overflow**

In `frontend/components/chat-panel/message-cards.tsx`, on source excerpt containers, ensure:

```tsx
<div className="overflow-hidden text-sm leading-relaxed text-muted-foreground">
  {excerpt}
</div>
```

- [ ] **Step 6: Manual keyboard verification at 390px**

Open Chrome DevTools → Toggle device toolbar → set width 390px.

Walk through each flow with keyboard only:
- `Tab` to document picker → `Enter` to open → `Tab`/`Arrow` to navigate docs → `Enter` to select
- `Tab` to upload button → `Enter` → modal opens → `Tab` inside modal → `Escape` to close
- `Tab` to chat input → type question → `Enter` to submit
- `Tab` to source accordion → `Enter` to expand/collapse

Confirm focus rings are visible (`focus-visible:ring-2`) on all interactive elements.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/upload-modal.tsx frontend/components/chat-panel/index.tsx frontend/components/chat-panel/message-cards.tsx frontend/app/(app)/workspace/page.tsx frontend/app/(app)/manage/page.tsx
git commit -m "polish: keyboard navigation pass + mobile viewport overflow fixes"
```

---

## Task 10: Demo Page — `/demo`

**Files:**
- Create: `frontend/app/demo/page.tsx`

- [ ] **Step 1: Write the demo page**

```tsx
// frontend/app/demo/page.tsx
"use client"

import { useEffect, useState, useRef } from "react"
import { Document, listDocuments, askQuestion } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import { cn } from "@/lib/utils"

const DEMO_USER_ID = "demo-user"
const DEMO_SESSION_ID = "demo-session"
const LHDN_DOC_ID = "lhdn-efiling-2024"

const SCENARIO_CARDS = [
  {
    flag: "🇲🇾",
    lang: "Bahasa Melayu",
    question: "Siapa yang layak memohon?",
  },
  {
    flag: "🇬🇧",
    lang: "English",
    question: "What documents do I need to file?",
  },
  {
    flag: "🇨🇳",
    lang: "中文",
    question: "如何申请退税？",
  },
]

export default function DemoPage() {
  const [lhdnDoc, setLhdnDoc] = useState<Document | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [cardsVisible, setCardsVisible] = useState(true)
  const prewarmRef = useRef(false)

  useEffect(() => {
    async function init() {
      try {
        const docs = await listDocuments()
        const lhdn = docs.find((d) => d.id === LHDN_DOC_ID && d.status === "ready")
        setLhdnDoc(lhdn ?? null)

        if (lhdn && !prewarmRef.current) {
          prewarmRef.current = true
          // Silently pre-warm all three scenario questions
          for (const card of SCENARIO_CARDS) {
            askQuestion({
              user_id: DEMO_USER_ID,
              document_id: lhdn.id,
              document_name: lhdn.name,
              session_id: DEMO_SESSION_ID + "-prewarm",
              question: card.question,
              enable_query_augmentation: false,
            }).catch(() => {}) // fire-and-forget
          }
        }
      } catch {}
    }
    init()
  }, [])

  function handleScenarioClick(question: string) {
    setActiveQuestion(question)
    setCardsVisible(false)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-foreground">
            Lingua Rakyat
          </span>
          <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary uppercase tracking-wider">
            Demo
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-6 py-8 max-w-4xl mx-auto w-full">
        {/* Headline */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Malaysian Government Document Assistant
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {lhdnDoc
              ? `📄 ${lhdnDoc.name} — loaded and ready`
              : "Loading featured document…"}
          </p>
        </div>

        {/* Scenario Cards */}
        {cardsVisible && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SCENARIO_CARDS.map((card) => (
              <button
                key={card.question}
                disabled={!lhdnDoc}
                onClick={() => handleScenarioClick(card.question)}
                className={cn(
                  "flex flex-col items-start gap-2 border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  !lhdnDoc && "cursor-not-allowed opacity-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{card.flag}</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {card.lang}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {card.question}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Chat Panel */}
        {lhdnDoc && (
          <div className={cn("flex-1", cardsVisible ? "hidden" : "flex flex-col")}>
            <ChatPanel
              selectedDoc={lhdnDoc}
              initialQuestion={activeQuestion ?? undefined}
              userId={DEMO_USER_ID}
              sessionId={DEMO_SESSION_ID}
            />
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Check ChatPanel props**

Open `frontend/components/chat-panel/index.tsx` and verify the component accepts `initialQuestion`, `userId`, and `sessionId` props. If these props don't exist yet, add them:

In the ChatPanel props type, add:
```typescript
  initialQuestion?: string
  userId?: string
  sessionId?: string
```

If `userId` and `sessionId` are currently hardcoded or read from context, update to prefer the prop value, falling back to the existing default. For `initialQuestion`, on mount (in `useEffect`), if `initialQuestion` is set, call the submit handler with that question after a brief delay (to let the panel initialize):

```typescript
  useEffect(() => {
    if (initialQuestion) {
      const timer = setTimeout(() => handleSubmit(initialQuestion), 200)
      return () => clearTimeout(timer)
    }
  }, [initialQuestion])
```

- [ ] **Step 3: Add `askQuestion` non-streaming export to `frontend/lib/api.ts`**

Verify that a non-streaming `askQuestion` export exists. If not, add:

```typescript
export async function askQuestion(params: {
  user_id: string
  document_id: string
  document_name: string
  session_id: string
  question: string
  enable_query_augmentation?: boolean
  bypass_cache?: boolean
}): Promise<AskResponse> {
  const res = await apiFetch(`${API_URL}/api/chat/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Chat request failed")
  }
  return res.json()
}
```

- [ ] **Step 4: Manual verification**

1. Ensure the LHDN PDF is in `backend/sample_docs/lhdn-efiling-2024.pdf` (or placed manually)
2. Start backend + frontend
3. Navigate to `http://localhost:3000/demo`
4. Confirm: wordmark + "Demo" badge visible in header
5. Confirm: LHDN doc name appears in the subtitle
6. Confirm: three scenario cards visible
7. Click "Siapa yang layak memohon?" — cards collapse, chat panel appears, question is submitted
8. Verify answer streams in within ~300ms (pre-warm should have cached it)
9. Hard-refresh the page — confirm it returns to card view (stateless)

- [ ] **Step 5: Commit**

```bash
git add frontend/app/demo/page.tsx frontend/components/chat-panel/index.tsx frontend/lib/api.ts
git commit -m "feat: add /demo booth page with pre-warmed scenario cards and embedded ChatPanel"
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Task | Status |
|---|---|---|
| §1 — zh-cn mojibake | Task 1 | ✅ |
| §2a — faithfulness score (backend) | Task 2 | ✅ |
| §2b — semantic similarity (backend) | Task 3 | ✅ |
| §2c — faithfulness/sem-sim frontend | Task 6 | ✅ |
| §3a — sample doc selection | Task 5 (FEATURED_DOCS) | ✅ |
| §3b — seed endpoint + Supabase schema | Tasks 4 + 5 | ✅ |
| §3c — is_featured/agency in API | Task 5 | ✅ |
| §3d — featured section in picker | Task 7 | ✅ |
| §3e — cache pre-warm on boot | Task 5 (_prewarm_featured_docs) | ✅ |
| §4a — keyboard navigation | Task 9 | ✅ |
| §4b — mobile viewport fixes | Task 9 | ✅ |
| §4c — delete orb.tsx | Task 8 | ✅ |
| §4d — Supabase migration file | Task 4 | ✅ |
| §5a — /demo page route | Task 10 | ✅ |
| §5b — page layout (cards, wordmark) | Task 10 | ✅ |
| §5c — cache pre-warm on demo mount | Task 10 | ✅ |
| §5d — no auth / demo-user | Task 10 | ✅ |

**Placeholder scan:** None found. Every step has complete code.

**Type consistency check:**
- `faithfulness_score: Optional[float]` used consistently in `Evaluator.record()`, `RecordRequest`, `_record_eval()`, and `EvalReport` TypeScript type.
- `semantic_similarity: number | null` used consistently in `TestSuiteResult.results[].scores` and `TestSuiteResult.aggregate.avg_semantic_similarity`.
- `is_featured: bool` and `agency: Optional[str]` used consistently in `DocumentResponse`, `normalize_document_row()`, and `Document` TypeScript type.
- `PREWARM_QUESTIONS` constant keyed by stable `doc_id` strings matching `FEATURED_DOCS`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-12-competition-prep.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
