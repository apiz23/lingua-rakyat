import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from main import app
from routers import documents


def test_private_api_responses_and_redirects_are_not_cached():
    with TestClient(app) as client:
        for path in ("/api/v1/me/conversations", "/api/v1/me/history?document_ref=doc", "/api/documents"):
            response = client.get(path, follow_redirects=False)
            assert response.headers.get("cache-control") == "no-store"


def test_pdf_range_request_is_not_cached(monkeypatch):
    class Query:
        def table(self, *_): return self
        def select(self, *_): return self
        def eq(self, *_): return self
        def limit(self, *_): return self
        def execute(self):
            return type("Result", (), {"data": [{"storage_path": "doc.pdf", "name": "doc"}]})()
        @property
        def storage(self): return self
        def from_(self, *_): return self
        def download(self, *_): return b"%PDF-test"

    monkeypatch.setattr(documents, "get_supabase", lambda: Query())
    with TestClient(app) as client:
        response = client.get("/api/documents/doc/pdf", headers={"Range": "bytes=0-3"})
        assert response.status_code == 200  # Proxy currently serves the whole file.
        assert response.headers["cache-control"] == "no-store"
