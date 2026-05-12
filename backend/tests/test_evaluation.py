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
