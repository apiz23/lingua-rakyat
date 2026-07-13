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
