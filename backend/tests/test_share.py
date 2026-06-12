import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
import utils.shared_answers as sa

_PAYLOAD = {
    "question": "Berapa yuran pasport?",
    "answer": "RM200 untuk 5 tahun.",
    "sources": [{"text": "...","document_id": "doc1","score": 0.9,"doc_name":"JPN"}],
    "language": "ms",
}

def _mock_supabase(stored: dict | None = None):
    mock = MagicMock()
    insert_chain = mock.table.return_value.insert.return_value.execute
    insert_chain.return_value.data = [{"slug": "abc12345"}]
    select_chain = mock.table.return_value.select.return_value.eq.return_value.execute
    select_chain.return_value.data = [stored] if stored else []
    return mock

def test_store_returns_slug():
    with patch.object(sa, "get_supabase", return_value=_mock_supabase()):
        slug = sa.store_share(**_PAYLOAD)
    assert isinstance(slug, str) and len(slug) > 0

def test_get_returns_payload():
    stored = {**_PAYLOAD, "slug": "abc12345", "id": "uuid", "created_at": "2026-06-12T00:00:00Z"}
    with patch.object(sa, "get_supabase", return_value=_mock_supabase(stored)):
        result = sa.get_share("abc12345")
    assert result is not None
    assert result["question"] == _PAYLOAD["question"]

def test_get_returns_none_for_missing():
    with patch.object(sa, "get_supabase", return_value=_mock_supabase(None)):
        result = sa.get_share("notfound")
    assert result is None
