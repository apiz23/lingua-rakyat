"""Revision-scoped indexing, approval, promotion, rollback and isolation."""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import admin_ingestion
from utils import authorization, revision_lifecycle
from utils.authorization import Actor, ActorKind
from utils.ingestion.extraction import ExtractionResult
from utils.rag_pipeline import revision_namespace

ACTOR = Actor(ActorKind.CITIZEN, "user_publisher")
NOW = datetime.now(timezone.utc)


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

    def order(self, *_args, **_kwargs):
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


class DB:
    def __init__(self, tables=None):
        self.tables = {name: [dict(row) for row in rows] for name, rows in (tables or {}).items()}
        self.storage = SimpleNamespace()
        self.rpc_failure: str | None = None

    def table(self, name):
        return Query(self, name)

    def rpc(self, name, params):
        if self.rpc_failure:
            raise RuntimeError(self.rpc_failure)
        if name == "review_current_document_revision":
            review_result = self.rpc("review_document_revision", params)
            document = next(
                row
                for row in self.tables["lr_documents"]
                if row["id"] == params["p_document_id"]
            )
            revision_row = next(
                row
                for row in self.tables["document_revisions"]
                if row["document_id"] == params["p_document_id"]
                and row["revision"] == params["p_revision"]
            )
            if params["p_action"] == "approve":
                src = next(
                    row
                    for row in self.tables["official_sources"]
                    if row["source_id"] == revision_row["source_id"]
                )
                document.update(
                    {
                        "publication_status": "approved",
                        "visibility_scope": "private",
                        "approved_by": params["p_actor"],
                        "approved_at": NOW.isoformat(),
                        "last_verified_at": src["last_verified_at"],
                        "source_id": revision_row["source_id"],
                        "source_type": revision_row["source_type"],
                    }
                )
                status = "approved"
            else:
                document.update(
                    {
                        "publication_status": "draft",
                        "approved_by": None,
                        "approved_at": None,
                    }
                )
                status = "draft"
            self.tables["admin_audit_log"].append(
                {
                    "action": f"review.{params['p_action']}",
                    "target_id": document["id"],
                    "state_to": status,
                }
            )
            return SimpleNamespace(
                data={**review_result.data, "publication_status": status}
            )

        if name == "review_document_revision":
            revision_row = next(
                (
                    row
                    for row in self.tables["document_revisions"]
                    if row["document_id"] == params["p_document_id"]
                    and row["revision"] == params["p_revision"]
                ),
                None,
            )
            if revision_row is None:
                raise RuntimeError("revision_not_found")
            document = next(
                row for row in self.tables["lr_documents"] if row["id"] == params["p_document_id"]
            )
            action = params["p_action"]
            if action == "approve":
                revision_row.update(
                    {
                        "approved_by": params["p_actor"],
                        "approved_at": NOW.isoformat(),
                        "review_status": "approved",
                        "reviewed_by": params["p_actor"],
                        "reviewed_at": NOW.isoformat(),
                        "review_reason": params.get("p_reason"),
                    }
                )
                self.tables["publication_events"].append(
                    {"event_type": "approval", "document_id": document["id"], "revision": revision_row["revision"]}
                )
                status = "approved"
            else:
                revision_row.update(
                    {
                        "approved_by": None,
                        "approved_at": None,
                        "review_status": "rejected" if action == "reject" else "changes_requested",
                        "reviewed_by": params["p_actor"],
                    }
                )
                status = revision_row["review_status"]
            self.tables["admin_audit_log"].append(
                {
                    "action": f"revision.{action}",
                    "target_id": f"{document['id']}:{revision_row['revision']}",
                    "reason": params.get("p_reason"),
                    "state_from": "pending",
                    "state_to": status,
                    "actor_id": params["p_actor"],
                }
            )
            return SimpleNamespace(data={**params, "review_status": status})

        if name == "promote_document_revision":
            document = next(
                row for row in self.tables["lr_documents"] if row["id"] == params["p_document_id"]
            )
            if document.get("current_revision") != params["p_expected_current"]:
                raise RuntimeError("concurrent_modification")
            target = next(
                (
                    row
                    for row in self.tables["document_revisions"]
                    if row["document_id"] == params["p_document_id"]
                    and row["revision"] == params["p_revision"]
                ),
                None,
            )
            if target is None:
                raise RuntimeError("revision_not_found")
            if target.get("review_status") != "approved":
                raise RuntimeError("revision_not_approved")
            if target.get("indexing_status") != "indexed":
                raise RuntimeError("revision_not_indexed")
            previous = document["current_revision"]
            document.update(
                {
                    "current_revision": params["p_revision"],
                    "document_version": params["p_revision"],
                    "checksum": target.get("checksum"),
                }
            )
            for row in self.tables["document_revisions"]:
                if row["document_id"] == params["p_document_id"]:
                    if row["revision"] == previous:
                        row["superseded_at"] = NOW.isoformat()
                    if row["revision"] == params["p_revision"]:
                        row["superseded_at"] = None
            self.tables["publication_events"].append(
                {
                    "event_type": "publication",
                    "document_id": params["p_document_id"],
                    "revision": params["p_revision"],
                    "details": {
                        "action": params["p_action"],
                        "previous_revision": previous,
                        "reason": params.get("p_reason"),
                    },
                }
            )
            self.tables["admin_audit_log"].append(
                {
                    "action": f"revision.{params['p_action']}",
                    "target_id": f"{params['p_document_id']}:{params['p_revision']}",
                    "reason": params.get("p_reason"),
                    "state_from": f"current:{previous}",
                    "state_to": f"current:{params['p_revision']}",
                    "actor_id": params["p_actor"],
                }
            )
            return SimpleNamespace(data={"current_revision": params["p_revision"]})
        raise RuntimeError("unknown_rpc")


def source(**overrides):
    row = {
        "source_id": "src-1",
        "issuing_organization": "Ministry",
        "source_type": "official_gov",
        "verification_status": "verified",
        "usage_permitted": True,
        "usage_rights": "Public information with attribution.",
        "freshness_days": 365,
        "last_verified_at": (NOW - timedelta(days=1)).isoformat(),
        "revoked_at": None,
    }
    row.update(overrides)
    return row


def document(**overrides):
    row = {
        "id": "doc-1",
        "name": "Guidance.pdf",
        "status": "ready",
        "visibility_scope": "public",
        "publication_status": "published",
        "source_id": "src-1",
        "source_type": "official_gov",
        "owner_type": "operator",
        "current_revision": 1,
        "document_version": 1,
        "checksum": "checksum-1",
        "approved_by": "user_admin",
        "approved_at": (NOW - timedelta(days=2)).isoformat(),
        "published_at": (NOW - timedelta(days=1)).isoformat(),
        "expires_at": None,
    }
    row.update(overrides)
    return row


def revision(number, **overrides):
    row = {
        "document_id": "doc-1",
        "revision": number,
        "source_id": "src-1",
        "source_type": "official_gov",
        "storage_path": f"doc-1/revision-{number}.pdf",
        "checksum": f"checksum-{number}",
        "approved_by": "user_reviewer" if number == 1 else None,
        "approved_at": (NOW - timedelta(days=2)).isoformat() if number == 1 else None,
        "review_status": "approved" if number == 1 else "pending",
        "indexing_status": "indexed",
        "chunk_count": 5,
        "index_namespace": revision_namespace("doc-1", number),
        "created_at": (NOW - timedelta(days=2)).isoformat(),
        "superseded_at": None,
        "revoked_at": None,
        "metadata": {"extraction_status": "complete", "page_count": 3, "requires_review": True},
    }
    row.update(overrides)
    return row


def base_db(**overrides):
    tables = {
        "lr_documents": [document()],
        "official_sources": [source()],
        "document_revisions": [revision(1)],
        "publication_events": [],
        "admin_audit_log": [],
        "admin_roles": [],
        "ingestion_candidates": [],
        "ingestion_jobs": [],
        "source_discovery_checkpoints": [],
    }
    tables.update(overrides)
    return DB(tables)


@pytest.fixture(autouse=True)
def index_verified(request, monkeypatch):
    if "vector_index_verification" in request.node.name:
        return
    monkeypatch.setattr(
        "utils.rag_pipeline.verify_revision_index",
        lambda namespace, chunks, **kwargs: True,
    )


def test_approval_requires_indexing_and_verified_source():
    db = base_db(
        document_revisions=[revision(2, indexing_status="failed", index_namespace=None)]
    )
    with pytest.raises(revision_lifecycle.RevisionValidationError):
        revision_lifecycle.review_revision(
            db, ACTOR, "doc-1", 2, action="approve"
        )
    db2 = base_db(
        document_revisions=[revision(2)],
        official_sources=[source(verification_status="unverified")],
    )
    with pytest.raises(revision_lifecycle.RevisionValidationError):
        revision_lifecycle.review_revision(db2, ACTOR, "doc-1", 2, action="approve")


def test_approval_records_actor_and_does_not_change_current():
    db = base_db(document_revisions=[revision(2)])
    result = revision_lifecycle.review_revision(
        db, ACTOR, "doc-1", 2, action="approve", reason="Checked against source"
    )
    assert result["review_status"] == "approved"
    assert result["approved_by"] == "user_publisher"
    assert db.tables["lr_documents"][0]["current_revision"] == 1
    assert any(row["action"] == "revision.approve" for row in db.tables["admin_audit_log"])
    assert db.tables["publication_events"][0]["event_type"] == "approval"


def test_reject_and_changes_require_reason():
    db = base_db(document_revisions=[revision(2)])
    with pytest.raises(revision_lifecycle.RevisionValidationError):
        revision_lifecycle.review_revision(db, ACTOR, "doc-1", 2, action="reject")
    result = revision_lifecycle.review_revision(
        db, ACTOR, "doc-1", 2, action="reject", reason="Wrong page"
    )
    assert result["review_status"] == "rejected"


def test_promotion_switches_current_only_after_approval_and_index_verification(monkeypatch):
    db = base_db(
        document_revisions=[
            revision(1),
            revision(2, approved_by="user_reviewer", approved_at=NOW.isoformat(), review_status="approved"),
        ]
    )
    result = revision_lifecycle.promote_revision(db, ACTOR, "doc-1", 2)
    assert result["is_current"] is True
    assert db.tables["lr_documents"][0]["current_revision"] == 2
    assert db.tables["lr_documents"][0]["checksum"] == "checksum-2"
    old = [rev for rev in db.tables["document_revisions"] if rev["revision"] == 1][0]
    assert old["superseded_at"]
    assert db.tables["publication_events"][-1]["event_type"] == "publication"
    assert db.tables["publication_events"][-1]["details"]["action"] == "promote"


def test_promotion_rejects_unapproved_revision():
    db = base_db(document_revisions=[revision(1), revision(2)])
    with pytest.raises(revision_lifecycle.RevisionValidationError):
        revision_lifecycle.promote_revision(db, ACTOR, "doc-1", 2)


def test_failed_index_verification_preserves_current(monkeypatch):
    def fail(*_args):
        raise revision_lifecycle.RevisionValidationError("Index verification failed")

    monkeypatch.setattr(revision_lifecycle, "_verify_index", fail)
    db = base_db(
        document_revisions=[
            revision(1),
            revision(2, approved_by="user_reviewer", approved_at=NOW.isoformat(), review_status="approved"),
        ]
    )
    with pytest.raises(revision_lifecycle.RevisionValidationError):
        revision_lifecycle.promote_revision(db, ACTOR, "doc-1", 2)
    assert db.tables["lr_documents"][0]["current_revision"] == 1


def test_atomic_promotion_failure_rolls_back_all_state():
    db = base_db(
        document_revisions=[
            revision(1),
            revision(2, approved_by="r", approved_at=NOW.isoformat(), review_status="approved"),
        ]
    )
    db.rpc_failure = "event_insertion_failed"
    with pytest.raises(revision_lifecycle.RevisionUnavailable):
        revision_lifecycle.promote_revision(db, ACTOR, "doc-1", 2)
    assert db.tables["lr_documents"][0]["current_revision"] == 1
    assert db.tables["publication_events"] == []
    assert all(not rev.get("superseded_at") for rev in db.tables["document_revisions"])


def test_atomic_approval_failure_leaves_revision_pending():
    db = base_db(document_revisions=[revision(2)])
    db.rpc_failure = "event_insertion_failed"
    with pytest.raises(revision_lifecycle.RevisionUnavailable):
        revision_lifecycle.review_revision(db, ACTOR, "doc-1", 2, action="approve")
    assert db.tables["document_revisions"][0]["review_status"] == "pending"
    assert db.tables["publication_events"] == []


def test_concurrent_promotion_cannot_corrupt_current(monkeypatch):
    db = base_db(
        lr_documents=[document(current_revision=2, document_version=2)],
        document_revisions=[
            revision(1),
            revision(2, approved_by="r", approved_at=NOW.isoformat(), review_status="approved"),
            revision(3, approved_by="r", approved_at=NOW.isoformat(), review_status="approved"),
        ],
    )
    stale = document(current_revision=1)
    monkeypatch.setattr(revision_lifecycle, "_document", lambda _client, _id: dict(stale))
    with pytest.raises(revision_lifecycle.RevisionConflict):
        revision_lifecycle.promote_revision(db, ACTOR, "doc-1", 3)


def test_rollback_requires_reason_and_preserves_history():
    db = base_db(
        document_revisions=[
            revision(1),
            revision(2, approved_by="r", approved_at=NOW.isoformat(), review_status="approved", superseded_at=NOW.isoformat()),
        ],
        lr_documents=[document(current_revision=2, document_version=2)],
    )
    with pytest.raises(revision_lifecycle.RevisionValidationError):
        revision_lifecycle.rollback_revision(db, ACTOR, "doc-1", 1, reason="")
    result = revision_lifecycle.rollback_revision(
        db, ACTOR, "doc-1", 1, reason="Incorrect revision"
    )
    assert result["revision"] == 1
    assert db.tables["lr_documents"][0]["current_revision"] == 1
    assert len(db.tables["document_revisions"]) == 2
    assert db.tables["publication_events"][-1]["details"]["action"] == "rollback"
    assert any(row["reason"] == "Incorrect revision" for row in db.tables["admin_audit_log"])


def test_revision_namespace_is_distinct_per_revision():
    assert revision_namespace("doc-1", 1) == "doc:doc-1:rev:1"
    assert revision_namespace("doc-1", 2) == "doc:doc-1:rev:2"
    assert revision_namespace("doc-1", 1) != revision_namespace("doc-1", 2)


def test_end_to_end_revision_promotion_and_rollback(monkeypatch):
    from utils import admin_service, eligibility
    from utils.ingestion import service as ingestion

    db = base_db(lr_documents=[], document_revisions=[])
    monkeypatch.setattr(ingestion, "_upload_pdf", lambda *_args: None)
    monkeypatch.setattr(
        ingestion,
        "_extract_or_fail",
        lambda _content: ExtractionResult(
            page_count=3, text_chars=900, extraction_status="complete"
        ),
    )

    def fake_index(document_id, revision, source_id, content, filename):
        return {
            "chunk_count": 4,
            "namespace": revision_namespace(document_id, revision),
            "indexed_at": NOW.isoformat(),
        }

    monkeypatch.setattr(ingestion, "_index_document", fake_index)

    def ingest(content: bytes) -> str:
        db.tables["ingestion_candidates"].append(
            {
                "id": str(uuid.uuid4()),
                "source_id": "src-1",
                "external_id": None,
                "source_url": "https://agency.example.gov.my/guidance.pdf",
                "canonical_url": "https://agency.example.gov.my/guidance.pdf",
                "title": "Guidance",
                "issuing_organization": "Ministry",
                "document_type": "pdf",
                "file_format": "pdf",
                "publication_date": None,
                "status": "discovered",
                "discovered_at": NOW.isoformat(),
            }
        )
        candidate = db.tables["ingestion_candidates"][-1]
        monkeypatch.setattr(
            ingestion,
            "_fetch_document",
            lambda url, src: SimpleNamespace(content=content, final_url=url, status_code=200),
        )
        job = ingestion.start_ingest(db, ACTOR, candidate["id"])
        ingestion.run_ingest(db, job["id"])
        return candidate["id"]

    ingest(b"%PDF-1.4 revision-one")
    document_id = db.tables["lr_documents"][0]["id"]
    assert db.tables["lr_documents"][0]["publication_status"] == "draft"

    admin_service.review_document(db, ACTOR, document_id, action="approve", reason=None)
    assert db.tables["document_revisions"][0]["review_status"] == "approved"
    assert db.tables["lr_documents"][0]["publication_status"] == "approved"
    admin_service.publish_document(db, ACTOR, document_id)
    assert db.tables["lr_documents"][0]["publication_status"] == "published"
    assert db.tables["lr_documents"][0]["current_revision"] == 1

    ingest(b"%PDF-1.4 revision-two-changed")
    assert db.tables["lr_documents"][0]["current_revision"] == 1
    assert len(db.tables["document_revisions"]) == 2
    assert [rev["indexing_status"] for rev in db.tables["document_revisions"]] == ["indexed", "indexed"]

    snapshot = eligibility.load_snapshot(db)
    assert eligibility.is_document_public(db.tables["lr_documents"][0], snapshot)
    assert eligibility.current_approved_revision(
        db.tables["lr_documents"][0], snapshot
    )["revision"] == 1

    revision_lifecycle.review_revision(db, ACTOR, document_id, 2, action="approve")
    revision_lifecycle.promote_revision(db, ACTOR, document_id, 2)
    assert db.tables["lr_documents"][0]["current_revision"] == 2
    assert len(db.tables["document_revisions"]) == 2

    revision_lifecycle.rollback_revision(
        db, ACTOR, document_id, 1, reason="Rollback for verification"
    )
    assert db.tables["lr_documents"][0]["current_revision"] == 1
    assert len(db.tables["document_revisions"]) == 2
    event_actions = [row.get("details", {}).get("action") for row in db.tables["publication_events"]]
    assert "promote" in event_actions
    assert "rollback" in event_actions


def test_revision_namespace_is_distinct_per_revision():
    assert revision_namespace("doc-1", 1) == "doc:doc-1:rev:1"
    assert revision_namespace("doc-1", 2) == "doc:doc-1:rev:2"
    assert revision_namespace("doc-1", 1) != revision_namespace("doc-1", 2)


class FakeIndex:
    def __init__(self):
        self.deleted = []
        self.upserts = []
        self.namespaces = {}

    def delete(self, delete_all, namespace):
        assert delete_all is True
        self.deleted.append(namespace)

    def upsert(self, vectors, namespace):
        self.upserts.append((namespace, vectors))
        self.namespaces[namespace] = {"vector_count": len(vectors)}

    def describe_index_stats(self):
        return SimpleNamespace(namespaces=self.namespaces)


def test_ingest_revision_indexes_isolated_namespace_with_metadata(monkeypatch):
    import utils.rag_pipeline as rag

    index = FakeIndex()
    monkeypatch.setattr(rag, "_get_index", lambda: index)
    monkeypatch.setattr(
        rag,
        "extract_pages_from_pdf",
        lambda _path: ([{"page_number": 1, "text": "page one"}], {"extraction_method": "text"}),
    )
    monkeypatch.setattr(
        rag,
        "chunk_pages",
        lambda _pages: [
            {
                "text": "chunk text",
                "page_start": 1,
                "page_end": 1,
                "section_title": "S",
            }
        ],
    )
    monkeypatch.setattr(rag, "get_embeddings_cohere", lambda texts: [[0.1, 0.2]])

    result = rag.ingest_revision(
        pdf_path="unused.pdf",
        document_id="doc-1",
        revision=2,
        source_id="src-1",
        document_name="Guidance",
    )

    namespace, vectors = index.upserts[0]
    assert namespace == "doc:doc-1:rev:2"
    assert result["chunk_count"] == 1
    metadata = vectors[0][2]
    assert metadata["doc_id"] == "doc-1"
    assert metadata["revision"] == 2
    assert metadata["source_id"] == "src-1"
    assert metadata["page_start"] == 1
    assert metadata["chunk_id"] == vectors[0][0]
    assert metadata["content_hash"]
    assert metadata["index_status"] == "indexed"
    assert index.deleted == ["doc:doc-1:rev:2"]


def test_retrieval_filters_out_pending_revision(monkeypatch):
    import utils.rag_pipeline as rag

    class Index:
        def query(self, vector, top_k, namespace, include_metadata):
            return {
                "matches": [
                    {
                        "id": "rev2",
                        "score": 0.9,
                        "metadata": {"doc_id": "doc-1", "revision": 2, "text": "pending"},
                    },
                    {
                        "id": "rev1",
                        "score": 0.8,
                        "metadata": {"doc_id": "doc-1", "revision": 1, "text": "current"},
                    },
                ]
            }

    monkeypatch.setattr(rag, "_get_index", lambda: Index())
    monkeypatch.setattr(rag, "get_embeddings_cohere", lambda texts, input_type="search_query": [[0.1]])
    monkeypatch.setattr(rag, "_cohere_rerank", lambda q, matches, top_n: matches[:top_n])

    matches = rag._retrieve_matches(
        namespaces=[revision_namespace("doc-1", 1)],
        query_variants=[{"key": "en", "text": "q", "variant_type": "original"}],
        top_k=5,
        allowed_revisions={"doc-1": 1},
    )
    assert [match["id"] for match in matches] == ["rev1"]


def test_vector_index_verification_checks_count_and_sample_metadata(monkeypatch):
    import utils.rag_pipeline as rag

    namespace = revision_namespace("doc-1", 2)

    class Index:
        def __init__(self, metadata=None, count=3):
            self.metadata = metadata
            self.count = count

        def describe_index_stats(self):
            return SimpleNamespace(namespaces={namespace: {"vector_count": self.count}})

        def fetch(self, ids, namespace):
            if self.metadata is None:
                raise RuntimeError("vectors deleted")
            return SimpleNamespace(
                vectors={vector_id: SimpleNamespace(metadata=self.metadata) for vector_id in ids}
            )

    monkeypatch.setattr(rag, "_get_index", lambda: Index({"doc_id": "doc-1", "revision": 2}))
    assert rag.verify_revision_index(namespace, 3, ["chunk-1"], "doc-1", 2)

    monkeypatch.setattr(rag, "_get_index", lambda: Index({"doc_id": "doc-1", "revision": 1}))
    assert not rag.verify_revision_index(namespace, 3, ["chunk-1"], "doc-1", 2)

    monkeypatch.setattr(rag, "_get_index", lambda: Index({"doc_id": "doc-1", "revision": 2}, count=1))
    assert not rag.verify_revision_index(namespace, 3, ["chunk-1"], "doc-1", 2)

    monkeypatch.setattr(rag, "_get_index", lambda: Index())
    assert not rag.verify_revision_index(namespace, 3, ["chunk-1"], "doc-1", 2)

    monkeypatch.setattr(rag, "_get_index", lambda: Index({"doc_id": "doc-1", "revision": 2}))
    assert not rag.verify_revision_index("doc:missing:rev:9", 3, ["chunk-1"], "doc-1", 2)


@pytest.fixture
def app():
    application = FastAPI()
    application.include_router(admin_ingestion.documents_router, prefix="/api/v1/admin/documents")
    return application


def test_revision_endpoints_reject_anonymous(app):
    with TestClient(app) as client:
        response = client.post("/api/v1/admin/documents/doc-1/revisions/2/promote", json={})
    assert response.status_code == 401


def test_revision_promotion_requires_publish_permission(app, monkeypatch):
    from utils.authorization import get_actor

    app.dependency_overrides[get_actor] = lambda: ACTOR
    monkeypatch.setattr(authorization, "resolve_permissions", lambda actor: frozenset({"admin.review"}))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/documents/doc-1/revisions/2/promote", json={}
        )
    assert response.status_code == 403
