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
