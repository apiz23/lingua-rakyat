# backend/tests/test_seed.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers.documents import FEATURED_DOCS


def test_featured_docs_defined():
    assert len(FEATURED_DOCS) == 2
    ids = [d["doc_id"] for d in FEATURED_DOCS]
    assert "jpn-mykad-faq" in ids
    assert "imigresen-passport" in ids


def test_featured_docs_have_required_fields():
    for doc in FEATURED_DOCS:
        assert "doc_id" in doc
        assert "name" in doc
        assert "agency" in doc
        assert "filename" in doc
        assert doc["agency"] in ("JPN", "IMIGRESEN")
