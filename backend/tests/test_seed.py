# backend/tests/test_seed.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers.documents import FEATURED_DOCS, SAMPLE_DOCS_DIR

KNOWN_AGENCIES = {"JPN", "IMIGRESEN", "KWSP", "PTPTN", "LHDN"}


def test_featured_docs_defined():
    assert len(FEATURED_DOCS) >= 2
    ids = [d["doc_id"] for d in FEATURED_DOCS]
    assert "jpn-mykad-faq" in ids
    assert "imigresen-passport" in ids
    assert len(ids) == len(set(ids)), "doc_ids must be unique"


def test_featured_docs_have_required_fields():
    for doc in FEATURED_DOCS:
        assert "doc_id" in doc
        assert "name" in doc
        assert "agency" in doc
        assert "filename" in doc
        assert doc["agency"] in KNOWN_AGENCIES


def test_featured_source_urls_are_https():
    for doc in FEATURED_DOCS:
        url = doc.get("source_url")
        if url is not None:
            assert url.startswith("https://"), f"{doc['doc_id']} source_url must be https"


def test_featured_docs_resolvable():
    # Every featured doc must either ship in sample_docs or declare a
    # source_url the seed can download it from.
    for doc in FEATURED_DOCS:
        local = os.path.exists(os.path.join(SAMPLE_DOCS_DIR, doc["filename"]))
        assert local or doc.get("source_url"), (
            f"{doc['doc_id']}: no local file and no source_url"
        )
