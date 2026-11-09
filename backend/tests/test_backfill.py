"""Historical revision backfill: dry-run, idempotency and safety."""

import hashlib
import os
import sys
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.ingestion import backfill
from utils.ingestion.extraction import ExtractionResult

NOW = datetime.now(timezone.utc)
PDF = b"%PDF-1.4 backfill"


class Query:
    def __init__(self, db, name):
        self.db = db
        self.name = name
        self.filters = []
        self.mode = None
        self.payload = None

    def select(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def insert(self, payload):
        self.mode = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.mode = "update"
        self.payload = payload
        return self

    def execute(self):
        rows = self.db.tables.setdefault(self.name, [])
        matches = [
            row
            for row in rows
            if all(str(row.get(field)) == str(value) for field, value in self.filters)
        ]
        if self.mode == "insert":
            rows.append(dict(self.payload))
            return SimpleNamespace(data=[dict(self.payload)])
        if self.mode == "update":
            for row in matches:
                row.update(self.payload)
            return SimpleNamespace(data=[dict(row) for row in matches])
        return SimpleNamespace(data=[dict(row) for row in matches])


class Storage:
    def from_(self, _bucket):
        return self

    def download(self, _path):
        return PDF


class DB:
    def __init__(self):
        self.tables = {
            "lr_documents": [
                {
                    "id": "doc-1",
                    "name": "Legacy",
                    "status": "ready",
                    "visibility_scope": "private",
                    "publication_status": "draft",
                    "storage_path": "doc-1/file.pdf",
                    "checksum": hashlib.sha256(PDF).hexdigest(),
                    "source_id": "src-1",
                    "source_type": "official_gov",
                    "current_revision": 1,
                    "document_version": 1,
                }
            ],
            "document_revisions": [],
            "official_sources": [],
            "publication_events": [],
            "admin_audit_log": [],
            "lr_admin_roles": [],
        }
        self.storage = Storage()

    def table(self, name):
        return Query(self, name)


@pytest.fixture(autouse=True)
def fake_extraction(monkeypatch):
    monkeypatch.setattr(
        backfill,
        "extract_pdf",
        lambda _content: ExtractionResult(
            page_count=2, text_chars=500, extraction_status="complete"
        ),
    )


def fake_indexer(**_kwargs):
    return {
        "chunk_count": 3,
        "namespace": "doc:doc-1:rev:1",
        "sample_chunk_ids": ["c1"],
        "indexed_at": NOW.isoformat(),
    }


def test_dry_run_plans_without_writes():
    db = DB()
    summary = backfill.run_backfill(db, dry_run=True, limit=10)
    assert summary.planned == 1
    assert db.tables["document_revisions"] == []
    assert db.tables["admin_audit_log"] == []
    assert db.tables["lr_documents"][0]["publication_status"] == "draft"


def test_apply_creates_pending_indexed_revision_only():
    db = DB()
    summary = backfill.run_backfill(db, dry_run=False, indexer=fake_indexer, limit=10)
    assert summary.created == 1
    assert summary.indexed == 1
    revision = db.tables["document_revisions"][0]
    assert revision["revision"] == 1
    assert revision["review_status"] == "pending"
    assert revision["approved_by"] is None
    assert revision["indexing_status"] == "indexed"
    assert revision["chunk_count"] == 3
    assert revision["verification_chunk_ids"] == ["c1"]
    document = db.tables["lr_documents"][0]
    assert document["publication_status"] == "draft"
    assert document["visibility_scope"] == "private"
    assert any(
        row["action"] == "revision.backfill" for row in db.tables["admin_audit_log"]
    )


def test_rerun_is_idempotent():
    db = DB()
    backfill.run_backfill(db, dry_run=False, indexer=fake_indexer, limit=10)
    summary = backfill.run_backfill(db, dry_run=False, indexer=fake_indexer, limit=10)
    assert summary.skipped == 1
    assert len(db.tables["document_revisions"]) == 1


def test_checksum_mismatch_refuses_to_backfill():
    db = DB()
    db.tables["lr_documents"][0]["checksum"] = "different"
    summary = backfill.run_backfill(db, dry_run=False, indexer=fake_indexer, limit=10)
    assert summary.failed == 1
    assert db.tables["document_revisions"] == []
    assert "checksum" in summary.results[0].error


def test_approved_revision_is_never_rewritten():
    db = DB()
    db.tables["document_revisions"].append(
        {
            "document_id": "doc-1",
            "revision": 1,
            "approved_by": "reviewer",
            "review_status": "approved",
            "indexing_status": "indexed",
            "chunk_count": 5,
            "checksum": hashlib.sha256(PDF).hexdigest(),
        }
    )
    summary = backfill.run_backfill(db, dry_run=False, indexer=fake_indexer, limit=10)
    assert summary.skipped == 1
    assert db.tables["document_revisions"][0]["chunk_count"] == 5


def test_index_failure_leaves_pending_failed_revision_and_document_unchanged():
    db = DB()

    def failing(**_kwargs):
        raise RuntimeError("embedding down")

    summary = backfill.run_backfill(db, dry_run=False, indexer=failing, limit=10)
    assert summary.failed == 1
    revision = db.tables["document_revisions"][0]
    assert revision["indexing_status"] == "failed"
    assert revision["review_status"] == "pending"
    document = db.tables["lr_documents"][0]
    assert document["publication_status"] == "draft"
    assert document["visibility_scope"] == "private"
    assert any(
        row["action"] == "revision.backfill_index_failed"
        for row in db.tables["admin_audit_log"]
    )
