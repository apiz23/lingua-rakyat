"""Answer caching stays disabled until revision-aware eligibility exists."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import utils.rag_pipeline as rag


def test_cache_is_disabled_by_default(monkeypatch):
    monkeypatch.setattr(rag, "ENABLE_ANSWER_CACHE", False)
    rag._query_cache.clear()
    rag.cache_set("q", "doc", {"answer": "a"})
    assert rag._query_cache == {}
    assert rag.cache_get("q", "doc") is None


def test_cache_round_trips_only_when_explicitly_enabled(monkeypatch):
    monkeypatch.setattr(rag, "ENABLE_ANSWER_CACHE", True)
    rag._query_cache.clear()
    rag.cache_set("q", "doc", {"answer": "a"})
    assert rag.cache_get("q", "doc") == {"answer": "a"}
