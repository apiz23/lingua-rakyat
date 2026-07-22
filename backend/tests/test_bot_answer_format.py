import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers.telegram import _format_answer as tg_format


def _result(**overrides):
    base = {
        "answer": "You need Form A.",
        "sources": [{"doc_name": "KWSP.pdf", "page_start": 3, "score": 0.42}],
        "language": "en",
        "confidence_label": "low",
        "evidence_mode": "cautious",
        "confidence_explanation": "Based on 1 moderate match, top score 42% — answer may be incomplete, verify with the official source",
    }
    base.update(overrides)
    return base


def test_telegram_appends_warning_when_cautious():
    out = tg_format(_result())
    assert "⚠ Based on 1 moderate match" in out


def test_no_warning_when_strong():
    out = tg_format(_result(evidence_mode="strong", confidence_explanation=None))
    assert "⚠" not in out


def test_no_crash_when_field_missing():
    r = _result()
    del r["confidence_explanation"]
    del r["evidence_mode"]
    out = tg_format(r)
    assert "You need Form A." in out
    assert "⚠" not in out
