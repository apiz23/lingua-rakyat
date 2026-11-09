import os
import sys
from datetime import datetime, timedelta, timezone

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
    now = datetime.now(timezone.utc)
    tables = {
        "lr_documents": [{
            "id": "doc",
            "name": "doc",
            "status": "ready",
            "visibility_scope": "public",
            "publication_status": "published",
            "source_id": "src-1",
            "source_type": "official_gov",
            "owner_type": "operator",
            "owner_id": "operator-1",
            "approved_by": "operator-1",
            "approved_at": (now - timedelta(days=2)).isoformat(),
            "published_at": (now - timedelta(days=1)).isoformat(),
            "last_verified_at": (now - timedelta(days=1)).isoformat(),
            "current_revision": 1,
        }],
        "official_sources": [{
            "source_id": "src-1",
            "source_type": "official_gov",
            "verification_status": "verified",
            "usage_permitted": True,
            "usage_rights": "Public information with attribution.",
            "freshness_days": 365,
            "last_verified_at": (now - timedelta(days=1)).isoformat(),
        }],
        "document_revisions": [{
            "document_id": "doc",
            "revision": 1,
            "storage_path": "doc/revision.pdf",
            "approved_by": "operator-1",
            "approved_at": (now - timedelta(days=2)).isoformat(),
        }],
    }

    class Query:
        def __init__(self):
            self._rows = []

        def table(self, name):
            self._rows = list(tables.get(name, []))
            return self

        def select(self, *_):
            return self

        def eq(self, field, value):
            self._rows = [row for row in self._rows if str(row.get(field)) == str(value)]
            return self

        def limit(self, *_):
            return self

        def execute(self):
            return type("Result", (), {"data": list(self._rows)})()

        @property
        def storage(self):
            return self

        def from_(self, *_):
            return self

        def download(self, *_):
            return b"%PDF-test"

    monkeypatch.setattr(documents, "get_supabase", lambda admin=False: Query())
    with TestClient(app) as client:
        response = client.get("/api/documents/doc/pdf", headers={"Range": "bytes=0-3"})
        assert response.status_code == 200  # Proxy currently serves the whole file.
        assert response.headers["cache-control"] == "no-store"
