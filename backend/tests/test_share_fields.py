import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import utils.shared_answers as sa
from routers.share import SharedAnswerResponse


class FakeQuery:
    def __init__(self, store, payload=None):
        self.store = store
        self.payload = payload
        self._slug = None

    def insert(self, payload):
        return FakeQuery(self.store, payload)

    def select(self, *_):
        return self

    def eq(self, _field, slug):
        self._slug = slug
        return self

    def execute(self):
        class Res:
            pass
        res = Res()
        if self.payload is not None:  # insert path
            self.store[self.payload["slug"]] = self.payload
            res.data = [self.payload]
        else:  # select path
            row = self.store.get(self._slug)
            res.data = [row] if row else []
        return res


class FakeSupabase:
    def __init__(self):
        self.store = {}

    def table(self, _name):
        return FakeQuery(self.store)


def _with_fake(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(sa, "get_supabase", lambda: fake)
    return fake


def test_store_share_persists_new_fields(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(
        question="Q", answer="A", sources=[], language="ms",
        confidence=0.82, confidence_label="high", agency="PTPTN",
    )
    row = fake.store[slug]
    assert row["confidence"] == 0.82
    assert row["confidence_label"] == "high"
    assert row["agency"] == "PTPTN"


def test_store_share_defaults_for_old_callers(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(question="Q", answer="A", sources=[], language="en")
    row = fake.store[slug]
    assert row["confidence"] == 0.0
    assert row["confidence_label"] == ""
    assert row["agency"] == ""


def test_get_share_roundtrip(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(
        question="Q", answer="A", sources=[{"doc_name": "KWSP.pdf", "page_start": 3}],
        language="en", confidence=0.4, confidence_label="low", agency="KWSP",
    )
    row = sa.get_share(slug)
    assert row["agency"] == "KWSP"
    assert row["sources"][0]["doc_name"] == "KWSP.pdf"


def test_response_model_defaults_for_old_rows():
    # Rows created before the migration lack the new keys entirely.
    old_row = {
        "slug": "abc", "question": "Q", "answer": "A",
        "sources": [], "language": "ms", "created_at": "2026-01-01T00:00:00Z",
    }
    resp = SharedAnswerResponse(
        slug=old_row["slug"], question=old_row["question"], answer=old_row["answer"],
        sources=old_row.get("sources", []), language=old_row.get("language", "ms"),
        created_at=old_row.get("created_at", ""),
        confidence=old_row.get("confidence", 0.0),
        confidence_label=old_row.get("confidence_label", "") or "",
        agency=old_row.get("agency", "") or "",
    )
    assert resp.confidence == 0.0
    assert resp.confidence_label == ""
    assert resp.agency == ""
