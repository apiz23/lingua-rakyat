"""Tests for multi-document retrieval (query across several namespaces).

Citizens upload several gov PDFs in one session and ask "which document
mentions X?" without picking a file. Retrieval must span every namespace,
merge, and let the reranker pick the best chunks across docs — and each
source must carry its own doc id so the UI shows where it came from.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import utils.rag_pipeline as rag
from utils.rag_pipeline import _resolve_namespaces


# ---- _resolve_namespaces (pure) ----

def test_single_document_id_resolves_to_one_namespace():
    assert _resolve_namespaces("a", None) == ["a"]


def test_document_ids_list_takes_precedence():
    assert _resolve_namespaces("a", ["b", "c"]) == ["b", "c"]


def test_blank_ids_are_dropped():
    assert _resolve_namespaces("a", ["", "  ", "b"]) == ["b"]


def test_duplicate_ids_deduped_preserving_order():
    assert _resolve_namespaces(None, ["b", "a", "b"]) == ["b", "a"]


def test_empty_everything_returns_empty():
    assert _resolve_namespaces(None, None) == []


# ---- _retrieve_matches across namespaces ----

class _FakeIndex:
    """Returns one distinct chunk per namespace so we can assert coverage."""
    def query(self, vector, top_k, namespace, include_metadata):
        return {"matches": [{
            "id": f"{namespace}_0",
            "score": 0.8,
            "metadata": {
                "text": f"chunk from {namespace}",
                "doc_id": namespace,
                "doc_name": namespace.upper(),
                "page_start": 1, "page_end": 1, "section_title": "S",
            },
        }]}


def test_retrieve_matches_spans_all_namespaces(monkeypatch):
    monkeypatch.setattr(rag, "get_embeddings_cohere", lambda texts, input_type="search_query": [[0.1]])
    monkeypatch.setattr(rag, "_get_index", lambda: _FakeIndex())
    # Disable rerank so we observe the merged set directly.
    monkeypatch.setattr(rag, "_cohere_rerank", lambda q, matches, top_n: matches[:top_n])

    variants = [{"key": "en", "text": "where is the tax relief?", "variant_type": "original"}]
    matches = rag._retrieve_matches(namespaces=["docA", "docB"], query_variants=variants, top_k=5)

    doc_ids = {m["metadata"]["doc_id"] for m in matches}
    assert doc_ids == {"docA", "docB"}


# ---- pipeline integration: per-source doc id ----

def test_pipeline_sources_carry_per_document_id(monkeypatch):
    def fake_retrieve(namespaces, query_variants, top_k):
        return [
            {"id": "docA_0", "score": 0.9, "reranked_score": 0.9,
             "metadata": {"text": "from A", "doc_id": "docA", "doc_name": "A",
                          "page_start": 1, "page_end": 1, "section_title": "S"},
             "variant_text": query_variants[0]["text"], "variant_type": "original"},
            {"id": "docB_0", "score": 0.85, "reranked_score": 0.85,
             "metadata": {"text": "from B", "doc_id": "docB", "doc_name": "B",
                          "page_start": 2, "page_end": 2, "section_title": "S"},
             "variant_text": query_variants[0]["text"], "variant_type": "original"},
        ]

    monkeypatch.setattr(rag, "_retrieve_matches", fake_retrieve)
    prepared = rag._prepare_pipeline(
        "which doc mentions tax relief?", document_id=None,
        document_ids=["docA", "docB"], enable_query_augmentation=False,
    )
    result = rag._build_result(prepared, "answer text", "test-model")
    source_doc_ids = {s["document_id"] for s in result["sources"]}
    assert source_doc_ids == {"docA", "docB"}
