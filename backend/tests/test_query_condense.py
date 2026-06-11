"""Tests for history-aware query condensation (_condense_query).

A follow-up like "what about for foreigners?" carries no subject. Before
retrieval we rewrite it into a standalone query using the recent chat history,
so the embedding actually matches the right chunks.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import utils.rag_pipeline as rag
from utils.rag_pipeline import _condense_query


def test_no_history_returns_question_unchanged():
    # No history → nothing to condense, no LLM call, not rewritten.
    out, rewritten = _condense_query("What is the renewal fee?", None, "en")
    assert out == "What is the renewal fee?"
    assert rewritten is False


def test_empty_history_turns_return_question_unchanged():
    # Turns missing question/answer text are unusable → treated as no history.
    history = [{"question": "", "answer": ""}, {"question": "  ", "answer": ""}]
    out, rewritten = _condense_query("What about for foreigners?", history, "en")
    assert out == "What about for foreigners?"
    assert rewritten is False


def test_followup_is_rewritten_using_history(monkeypatch):
    history = [{"question": "How much is passport renewal?",
                "answer": "Passport renewal for citizens is RM200."}]
    monkeypatch.setattr(rag, "_condense_llm_call",
                        lambda prompt: "passport renewal fee for foreigners")
    out, rewritten = _condense_query("What about for foreigners?", history, "en")
    assert out == "passport renewal fee for foreigners"
    assert rewritten is True


def test_llm_failure_falls_back_to_original(monkeypatch):
    history = [{"question": "Q", "answer": "A"}]
    monkeypatch.setattr(rag, "_condense_llm_call", lambda prompt: None)
    out, rewritten = _condense_query("What about for foreigners?", history, "en")
    assert out == "What about for foreigners?"
    assert rewritten is False


def test_llm_empty_string_falls_back_to_original(monkeypatch):
    history = [{"question": "Q", "answer": "A"}]
    monkeypatch.setattr(rag, "_condense_llm_call", lambda prompt: "   ")
    out, rewritten = _condense_query("What about for foreigners?", history, "en")
    assert out == "What about for foreigners?"
    assert rewritten is False


def test_llm_label_and_quotes_are_stripped(monkeypatch):
    history = [{"question": "Q", "answer": "A"}]
    monkeypatch.setattr(rag, "_condense_llm_call",
                        lambda prompt: 'Standalone question: "passport fee for foreigners"')
    out, rewritten = _condense_query("what about foreigners?", history, "en")
    assert out == "passport fee for foreigners"
    assert rewritten is True


def test_overlong_llm_output_falls_back_to_original(monkeypatch):
    history = [{"question": "Q", "answer": "A"}]
    monkeypatch.setattr(rag, "_condense_llm_call", lambda prompt: "word " * 100)
    out, rewritten = _condense_query("short follow up?", history, "en")
    assert out == "short follow up?"
    assert rewritten is False


def _stub_match(text="A passport renewal fee applies."):
    return {
        "id": "doc1_0", "score": 0.9, "reranked_score": 0.9,
        "metadata": {"text": text, "doc_name": "D", "page_start": 1,
                     "page_end": 1, "section_title": "S"},
        "variant_text": text, "variant_type": "original",
    }


def test_pipeline_retrieves_with_condensed_query(monkeypatch):
    # The condensed standalone query must drive retrieval; the original
    # follow-up must still drive the answer prompt.
    captured = {}
    monkeypatch.setattr(rag, "_condense_llm_call",
                        lambda p: "passport renewal fee for foreigners")

    def fake_retrieve(namespaces, query_variants, top_k):
        captured["variants"] = [v["text"] for v in query_variants]
        return [_stub_match()]

    monkeypatch.setattr(rag, "_retrieve_matches", fake_retrieve)
    history = [{"question": "How much is passport renewal?",
                "answer": "It is RM200 for citizens."}]
    prepared = rag._prepare_pipeline(
        "What about for foreigners?", "doc1",
        enable_query_augmentation=False, chat_history=history,
    )
    assert captured["variants"] == ["passport renewal fee for foreigners"]
    assert prepared["question"] == "What about for foreigners?"


def test_pipeline_uses_raw_question_when_no_history(monkeypatch):
    captured = {}

    def fake_retrieve(namespaces, query_variants, top_k):
        captured["variants"] = [v["text"] for v in query_variants]
        return [_stub_match()]

    monkeypatch.setattr(rag, "_retrieve_matches", fake_retrieve)
    rag._prepare_pipeline(
        "What is the renewal fee?", "doc1",
        enable_query_augmentation=False, chat_history=None,
    )
    assert captured["variants"] == ["What is the renewal fee?"]
