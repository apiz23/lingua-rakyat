"""Admin management: permissions, services, lifecycle and audit."""

import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import admin as admin_router
from utils import admin_service, authorization
from utils.authorization import Actor, ActorKind

ACTOR = Actor(ActorKind.CITIZEN, "user_admin")
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

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
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

    def _matches(self, row):
        return all(str(row.get(field)) == str(value) for field, value in self.filters)

    def execute(self):
        rows = self.db.tables.setdefault(self.name, [])
        if self.mode == "insert":
            rows.append(dict(self.payload))
            return SimpleNamespace(data=[dict(self.payload)])
        if self.mode == "update":
            changed = []
            for row in rows:
                if self._matches(row):
                    row.update(self.payload)
                    changed.append(dict(row))
            return SimpleNamespace(data=changed)
        return SimpleNamespace(data=[dict(row) for row in rows if self._matches(row)])


class DB:
    def __init__(self, tables=None, missing=None):
        self.tables = {name: [dict(row) for row in rows] for name, rows in (tables or {}).items()}
        self.missing = set(missing or ())

    def table(self, name):
        if name in self.missing:
            raise Exception(f'Error 42P01: relation "public.{name}" does not exist')
        return Query(self, name)


def source(**overrides):
    row = {
        "source_id": "src-1",
        "issuing_organization": "Ministry",
        "source_type": "official_gov",
        "verification_status": "verified",
        "verified_by": "user_admin",
        "verified_at": NOW.isoformat(),
        "usage_permitted": True,
        "usage_rights": "public-info",
        "freshness_days": 365,
        "last_verified_at": (NOW - timedelta(days=1)).isoformat(),
        "revoked_at": None,
    }
    row.update(overrides)
    return row


def document(**overrides):
    row = {
        "id": "doc-1",
        "name": "Doc.pdf",
        "status": "ready",
        "size_bytes": 10,
        "chunk_count": 2,
        "uploaded_at": (NOW - timedelta(days=3)).isoformat(),
        "storage_path": "doc-1/file.pdf",
        "visibility_scope": "private",
        "publication_status": "draft",
        "source_id": "src-1",
        "source_type": "official_gov",
        "owner_type": "operator",
        "owner_id": "operator-1",
        "approved_by": None,
        "approved_at": None,
        "published_at": None,
        "expires_at": None,
        "last_verified_at": None,
        "document_version": 1,
        "current_revision": 1,
        "revoked_at": None,
        "superseded_by": None,
    }
    row.update(overrides)
    return row


def approved_document(**overrides):
    return document(
        publication_status="approved",
        visibility_scope="public",
        approved_by="user_admin",
        approved_at=(NOW - timedelta(hours=1)).isoformat(),
        last_verified_at=(NOW - timedelta(days=1)).isoformat(),
        **overrides,
    )


def revision(**overrides):
    row = {
        "document_id": "doc-1",
        "revision": 1,
        "source_id": "src-1",
        "source_type": "official_gov",
        "storage_path": "doc-1/file.pdf",
        "approved_by": "user_admin",
        "approved_at": (NOW - timedelta(hours=1)).isoformat(),
        "created_at": (NOW - timedelta(days=3)).isoformat(),
        "superseded_at": None,
        "revoked_at": None,
        "indexing_status": "indexed",
        "chunk_count": 6,
        "index_namespace": "doc:doc-1:rev:1",
        "review_status": "approved",
    }
    row.update(overrides)
    return row


def base_db(missing=None, **overrides):
    tables = {
        "lr_documents": [document()],
        "official_sources": [source()],
        "document_revisions": [revision()],
        "publication_events": [],
        "admin_audit_log": [],
        "admin_roles": [],
    }
    tables.update(overrides)
    return DB(tables, missing=missing)


def install_atomic_review_rpc(monkeypatch, db):
    from utils import revision_lifecycle

    def fake_rpc(client, name, params):
        assert client is db
        assert name == "review_current_document_revision"
        doc = next(
            row
            for row in db.tables["lr_documents"]
            if row["id"] == params["p_document_id"]
        )
        rev = next(
            row
            for row in db.tables["document_revisions"]
            if row["document_id"] == params["p_document_id"]
            and row["revision"] == params["p_revision"]
        )
        action = params["p_action"]
        if action == "approve":
            src = next(
                row
                for row in db.tables["official_sources"]
                if row["source_id"] == rev["source_id"]
            )
            rev.update(
                {
                    "approved_by": params["p_actor"],
                    "approved_at": NOW.isoformat(),
                    "review_status": "approved",
                    "reviewed_by": params["p_actor"],
                    "reviewed_at": NOW.isoformat(),
                    "review_reason": params.get("p_reason"),
                }
            )
            doc.update(
                {
                    "publication_status": "approved",
                    "visibility_scope": "private",
                    "approved_by": params["p_actor"],
                    "approved_at": NOW.isoformat(),
                    "last_verified_at": src["last_verified_at"],
                    "source_id": rev["source_id"],
                    "source_type": rev["source_type"],
                }
            )
            db.tables["publication_events"].append(
                {
                    "event_type": "approval",
                    "document_id": doc["id"],
                    "revision": rev["revision"],
                }
            )
            status = "approved"
        else:
            rev.update(
                {
                    "approved_by": None,
                    "approved_at": None,
                    "review_status": (
                        "rejected" if action == "reject" else "changes_requested"
                    ),
                    "reviewed_by": params["p_actor"],
                    "review_reason": params.get("p_reason"),
                }
            )
            doc.update(
                {
                    "publication_status": "draft",
                    "approved_by": None,
                    "approved_at": None,
                }
            )
            status = "draft"
        db.tables["admin_audit_log"].append(
            {"action": f"review.{action}", "target_id": doc["id"], "state_to": status}
        )
        return {"data": {"review_status": status}}

    monkeypatch.setattr(revision_lifecycle, "_rpc", fake_rpc)
    monkeypatch.setattr(
        revision_lifecycle, "_verify_index", lambda *_args, **_kwargs: None
    )


# ---------------------------------------------------------------------------
# Permission boundaries
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    application = FastAPI()
    application.include_router(admin_router.router, prefix="/api/v1/admin")
    return application


def _allow(monkeypatch, db, permissions, app=None):
    monkeypatch.setattr(
        authorization, "resolve_permissions", lambda actor: frozenset(permissions)
    )
    monkeypatch.setattr(admin_router, "_client", lambda: db)
    if app is not None:
        from utils.authorization import get_actor

        app.dependency_overrides[get_actor] = lambda: ACTOR


def test_admin_endpoints_reject_anonymous(app):
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/dashboard")
    assert response.status_code == 401


@pytest.mark.parametrize(
    "header", ["Basic abc", "Bearer", "Bearer   ", "Token abc", "Bearer a b"]
)
def test_admin_endpoints_reject_malformed_authorization(app, header):
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/admin/dashboard", headers={"Authorization": header}
        )
    assert response.status_code == 401


def test_authenticated_without_permission_is_403(app, monkeypatch):
    _allow(monkeypatch, base_db(), set(), app)
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/dashboard")
    assert response.status_code == 403


def test_role_provider_unavailable_fails_closed_503(app, monkeypatch):
    def unavailable(_actor):
        raise authorization.RoleSourceUnavailable("no provider")

    from utils.authorization import get_actor

    app.dependency_overrides[get_actor] = lambda: ACTOR
    monkeypatch.setattr(authorization, "resolve_permissions", unavailable)
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/dashboard")
    assert response.status_code == 503


def test_dashboard_requires_its_permission_not_just_login(app, monkeypatch):
    _allow(monkeypatch, base_db(), {"admin.documents.read"}, app)
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/dashboard")
    assert response.status_code == 403


def test_dashboard_returns_real_metrics(app, monkeypatch):
    db = base_db(
        lr_documents=[
            document(),
            approved_document(id="doc-2"),
            document(id="doc-3", publication_status="published", approved_by="u", approved_at=NOW.isoformat()),
            document(id="doc-4", publication_status="suspended"),
            document(id="doc-5", status="error"),
            document(
                id="doc-6",
                publication_status="published",
                expires_at=(NOW + timedelta(days=5)).isoformat(),
            ),
        ],
        official_sources=[source(), source(source_id="src-2", verification_status="unverified")],
    )
    _allow(monkeypatch, db, {"admin.dashboard.read"}, app)
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/dashboard")
    assert response.status_code == 200
    metrics = response.json()["metrics"]
    assert metrics["total_documents"] == 6
    assert metrics["published"] == 2
    assert metrics["suspended"] == 1
    assert metrics["failed_ingestion"] == 1
    assert metrics["unverified_sources"] == 1
    assert metrics["expiring"] == 1


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------


def test_document_listing_filters_and_hides_storage_paths():
    db = base_db(
        lr_documents=[
            document(),
            document(id="doc-2", name="Passport.pdf", agency="IMIGRESEN", status="error"),
        ]
    )
    result = admin_service.list_documents(db, ACTOR, query="passport")
    assert result["total"] == 1
    assert result["items"][0]["id"] == "doc-2"
    assert "storage_path" not in result["items"][0]
    assert result["items"][0]["has_storage"] is True


def test_legacy_document_without_revision_cannot_publish():
    legacy = approved_document()
    blockers = admin_service.publication_blockers(legacy, source(), None)
    assert "missing_current_revision" in blockers


def test_metadata_update_associates_existing_source():
    db = base_db(lr_documents=[document(source_id=None, source_type=None)])
    result = admin_service.update_document_metadata(db, ACTOR, "doc-1", {"source_id": "src-1"})
    assert result["source_id"] == "src-1"
    assert result["source_type"] == "official_gov"
    assert any(row["action"] == "document.metadata_update" for row in db.tables["admin_audit_log"])


def test_metadata_update_rejects_unknown_source():
    db = base_db()
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.update_document_metadata(db, ACTOR, "doc-1", {"source_id": "missing"})



def test_source_registration_verification_and_audit():
    db = base_db(official_sources=[])
    created = admin_service.create_source(
        db,
        ACTOR,
        {
            "source_id": "src-new",
            "issuing_organization": "Ministry",
            "source_type": "official_gov",
        },
    )
    assert created["verification_status"] == "unverified"
    assert created["usage_permitted"] is False

    with pytest.raises(admin_service.AdminValidationError):
        admin_service.verify_source(
            db, ACTOR, "src-new", evidence="", freshness_days=30,
            usage_rights=None, usage_permitted=True,
        )

    with pytest.raises(admin_service.AdminValidationError, match="Usage rights"):
        admin_service.verify_source(
            db, ACTOR, "src-new", evidence="Checked official portal",
            freshness_days=30, usage_rights="   ", usage_permitted=True,
        )

    verified = admin_service.verify_source(
        db,
        ACTOR,
        "src-new",
        evidence="Checked official portal on 2026-11-04",
        freshness_days=90,
        usage_rights="public-info",
        usage_permitted=True,
    )
    assert verified["verification_status"] == "verified"
    assert verified["verified_by"] == "user_admin"
    actions = [row["action"] for row in db.tables["admin_audit_log"]]
    assert "source.register" in actions
    assert "source.verify" in actions


def test_upload_source_requires_current_verified_and_permitted_source():
    db = base_db()
    result = admin_service.verified_source_for_upload(
        db, ACTOR, "src-1", now=NOW
    )
    assert result["source_id"] == "src-1"

    unverified_db = base_db(
        official_sources=[source(verification_status="unverified")]
    )
    with pytest.raises(admin_service.AdminValidationError, match="verified"):
        admin_service.verified_source_for_upload(
            unverified_db, ACTOR, "src-1", now=NOW
        )

    stale_db = base_db(
        official_sources=[
            source(last_verified_at=(NOW - timedelta(days=366)).isoformat())
        ]
    )
    with pytest.raises(admin_service.AdminValidationError, match="stale"):
        admin_service.verified_source_for_upload(
            stale_db, ACTOR, "src-1", now=NOW
        )

    missing_rights_db = base_db(official_sources=[source(usage_rights=" ")])
    with pytest.raises(admin_service.AdminValidationError, match="rights"):
        admin_service.verified_source_for_upload(
            missing_rights_db, ACTOR, "src-1", now=NOW
        )

    invalid_policy_db = base_db(
        official_sources=[source(freshness_days=3651)]
    )
    with pytest.raises(admin_service.AdminValidationError, match="freshness"):
        admin_service.verified_source_for_upload(
            invalid_policy_db, ACTOR, "src-1", now=NOW
        )


def test_admin_upload_binds_a_current_verified_source(app, monkeypatch):
    from routers import documents

    db = base_db()
    db.storage = SimpleNamespace(
        from_=lambda _bucket: SimpleNamespace(upload=lambda *_args: None)
    )
    _allow(monkeypatch, db, {"admin.documents.write"}, app)
    monkeypatch.setattr(documents, "get_bucket", lambda: "documents")
    monkeypatch.setattr(documents, "validate_uploaded_pdf_bytes", lambda _content: None)
    monkeypatch.setattr(documents, "ingest_uploaded_document", lambda *_args: None)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/documents/upload",
            files={"file": ("manual.pdf", b"%PDF-test", "application/pdf")},
            data={"source_id": "src-1"},
        )

    assert response.status_code == 200
    uploaded = next(
        row for row in db.tables["lr_documents"] if row["id"] == response.json()["id"]
    )
    assert uploaded["source_id"] == "src-1"
    assert uploaded["source_type"] == "official_gov"
    assert uploaded["publication_status"] == "draft"
    assert uploaded["visibility_scope"] == "private"


def test_admin_upload_rejects_unverified_source(app, monkeypatch):
    from routers import documents

    db = base_db(
        official_sources=[source(verification_status="unverified")]
    )
    db.storage = SimpleNamespace(
        from_=lambda _bucket: SimpleNamespace(upload=lambda *_args: None)
    )
    _allow(monkeypatch, db, {"admin.documents.write"}, app)
    monkeypatch.setattr(documents, "get_bucket", lambda: "documents")
    monkeypatch.setattr(documents, "validate_uploaded_pdf_bytes", lambda _content: None)
    monkeypatch.setattr(documents, "ingest_uploaded_document", lambda *_args: None)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/documents/upload",
            files={"file": ("manual.pdf", b"%PDF-test", "application/pdf")},
            data={"source_id": "src-1"},
        )

    assert response.status_code == 400
    assert "verified" in response.json()["detail"]


def test_admin_upload_removes_stored_file_if_document_insert_fails(app, monkeypatch):
    from routers import documents

    db = base_db()
    removed_paths = []
    storage = SimpleNamespace(
        upload=lambda *_args: None,
        remove=lambda paths: removed_paths.extend(paths),
    )
    db.storage = SimpleNamespace(from_=lambda _bucket: storage)
    original_table = db.table

    def table(name):
        query = original_table(name)
        if name == "lr_documents":
            query.insert = lambda _payload: (_ for _ in ()).throw(
                RuntimeError("database unavailable")
            )
        return query

    db.table = table
    _allow(monkeypatch, db, {"admin.documents.write"}, app)
    monkeypatch.setattr(documents, "get_bucket", lambda: "documents")
    monkeypatch.setattr(documents, "validate_uploaded_pdf_bytes", lambda _content: None)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/documents/upload",
            files={"file": ("manual.pdf", b"%PDF-test", "application/pdf")},
            data={"source_id": "src-1"},
        )

    assert response.status_code == 503
    assert len(removed_paths) == 1
    assert removed_paths[0].endswith("/manual.pdf")


def test_source_revoke_requires_reason_and_denies_use():
    db = base_db()
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.revoke_source(db, ACTOR, "src-1", reason="")
    revoked = admin_service.revoke_source(db, ACTOR, "src-1", reason="Superseded")
    assert revoked["verification_status"] == "revoked"
    assert revoked["usage_permitted"] is False


def test_approve_creates_revision_event_and_synchronizes_current_revision(monkeypatch):
    pending_revision = revision(
        approved_by=None,
        approved_at=None,
        review_status="pending",
    )
    db = base_db(document_revisions=[pending_revision])
    install_atomic_review_rpc(monkeypatch, db)
    result = admin_service.review_document(
        db, ACTOR, "doc-1", action="approve", reason="Verified against source"
    )
    assert result["publication_status"] == "approved"
    assert result["visibility_scope"] == "private"
    assert result["revision"]["review_status"] == "approved"
    assert db.tables["document_revisions"][0]["approved_by"] == ACTOR.subject
    assert db.tables["publication_events"][0]["event_type"] == "approval"
    assert any(row["action"] == "review.approve" for row in db.tables["admin_audit_log"])

    published = admin_service.publish_document(db, ACTOR, "doc-1")
    assert published["publication_status"] == "published"
    assert published["visibility_scope"] == "public"
    assert db.tables["publication_events"][-1]["event_type"] == "publication"


def test_approve_requires_verified_source():
    db = base_db(
        official_sources=[source(verification_status="unverified")],
        document_revisions=[
            revision(approved_by=None, approved_at=None, review_status="pending")
        ],
    )
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.review_document(db, ACTOR, "doc-1", action="approve", reason=None)


def test_review_queue_contains_pending_revisions_but_not_approved_documents():
    pending_doc = document()
    approved_doc = approved_document(id="doc-2")
    db = base_db(
        lr_documents=[pending_doc, approved_doc],
        document_revisions=[
            revision(approved_by=None, approved_at=None, review_status="pending"),
            revision(
                document_id="doc-2",
                approved_by=ACTOR.subject,
                approved_at=NOW.isoformat(),
                review_status="approved",
            ),
        ],
    )

    queue = admin_service.review_queue(db, ACTOR)

    assert [item["id"] for item in queue] == ["doc-1"]
    assert "missing_approval" in queue[0]["blockers"]
    assert "revision_not_approved" in queue[0]["blockers"]


def test_reject_requires_reason_and_clears_approval(monkeypatch):
    db = base_db(lr_documents=[approved_document()])
    install_atomic_review_rpc(monkeypatch, db)
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.review_document(db, ACTOR, "doc-1", action="reject", reason="")
    result = admin_service.review_document(
        db, ACTOR, "doc-1", action="reject", reason="Wrong revision"
    )
    assert result["publication_status"] == "draft"
    assert result["approved_by"] is None
    assert any(row["action"] == "review.reject" for row in db.tables["admin_audit_log"])


def test_publish_rejects_unapproved_document():
    db = base_db()
    with pytest.raises(admin_service.AdminConflict):
        admin_service.publish_document(db, ACTOR, "doc-1")


def test_publish_requires_all_eligibility_inputs():
    db = base_db(
        lr_documents=[approved_document()],
        official_sources=[source(verification_status="unverified")],
    )
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.publish_document(db, ACTOR, "doc-1")


def test_publish_sets_publication_and_hides_storage_paths():
    db = base_db(lr_documents=[approved_document()])
    result = admin_service.publish_document(db, ACTOR, "doc-1")
    assert result["publication_status"] == "published"
    assert result["visibility_scope"] == "public"
    assert "storage_path" not in result
    assert db.tables["publication_events"][0]["event_type"] == "publication"
    assert any(row["action"] == "document.publish" for row in db.tables["admin_audit_log"])


def test_suspend_and_withdraw_require_reason_and_record_events():
    db = base_db(
        lr_documents=[
            document(id="doc-1", publication_status="published"),
            document(id="doc-2", publication_status="approved"),
        ]
    )
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.lifecycle_action(db, ACTOR, "doc-1", action="suspend", reason="")

    suspended = admin_service.lifecycle_action(
        db, ACTOR, "doc-1", action="suspend", reason="Content dispute"
    )
    assert suspended["publication_status"] == "suspended"
    withdrawn = admin_service.lifecycle_action(
        db, ACTOR, "doc-2", action="withdraw", reason="Superseded"
    )
    assert withdrawn["publication_status"] == "archived"
    event_types = [row["event_type"] for row in db.tables["publication_events"]]
    assert event_types == ["suspension", "withdrawal"]


def test_revisions_are_listed_without_storage_paths():
    db = base_db(
        document_revisions=[
            revision(revision=2, superseded_at=None),
            revision(revision=1, superseded_at=NOW.isoformat()),
        ],
        lr_documents=[document(current_revision=2)],
    )
    rows = admin_service.list_revisions(db, ACTOR, "doc-1")
    assert [row["revision"] for row in rows] == [2, 1]
    assert all("storage_path" not in row for row in rows)
    assert rows[0]["is_current"] is True


def test_role_grant_rejects_self_promotion_and_unknown_role():
    db = base_db()
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.grant_role(
            db, ACTOR, target_actor_id="user_admin", role="super_admin", reason=None
        )
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.grant_role(
            db, ACTOR, target_actor_id="user_other", role="owner", reason=None
        )
    granted = admin_service.grant_role(
        db, ACTOR, target_actor_id="user_other", role="reviewer", reason="New reviewer"
    )
    assert granted["role"] == "reviewer"
    with pytest.raises(admin_service.AdminConflict):
        admin_service.grant_role(
            db, ACTOR, target_actor_id="user_other", role="reviewer", reason=None
        )
    with pytest.raises(admin_service.AdminValidationError):
        admin_service.revoke_role(
            db, ACTOR, target_actor_id="user_admin", role="super_admin", reason="x"
        )


def test_audit_log_filters_and_pagination():
    db = base_db(
        admin_audit_log=[
            {
                "id": index,
                "actor_id": "user_admin",
                "action": "document.publish" if index % 2 else "source.register",
                "target_type": "document",
                "target_id": f"doc-{index}",
                "created_at": f"2026-11-04T00:00:0{index}Z",
            }
            for index in range(5)
        ]
    )
    result = admin_service.list_audit_logs(db, ACTOR, action="document", page=1, page_size=1)
    assert result["total"] == 2
    assert len(result["items"]) == 1


def test_missing_admin_tables_fail_unavailable():
    db = DB({"lr_documents": [document()]}, missing={"admin_audit_log"})
    with pytest.raises(admin_service.AdminUnavailable):
        admin_service.dashboard(db, ACTOR)


def test_actor_without_admin_permission_does_not_reach_services(app, monkeypatch):
    _allow(monkeypatch, base_db(), {"admin.audit.read"}, app)
    with TestClient(app) as client:
        detail = client.get("/api/v1/admin/documents/doc-1")
        sources = client.get("/api/v1/admin/sources")
    assert detail.status_code == 403
    assert sources.status_code == 403


def test_dashboard_uses_latest_review_decision():
    db = base_db(
        admin_audit_log=[
            {
                "id": 1,
                "actor_id": "user_admin",
                "action": "review.reject",
                "target_type": "document",
                "target_id": "doc-1",
                "created_at": "2026-11-01T00:00:00Z",
            },
            {
                "id": 2,
                "actor_id": "user_admin",
                "action": "review.approve",
                "target_type": "document",
                "target_id": "doc-1",
                "created_at": "2026-11-02T00:00:00Z",
            },
        ]
    )
    assert admin_service.dashboard(db, ACTOR)["metrics"]["rejected"] == 0


def test_missing_publication_event_store_fails_unavailable(monkeypatch):
    from utils import revision_lifecycle

    db = base_db(
        missing={"publication_events"},
        document_revisions=[
            revision(approved_by=None, approved_at=None, review_status="pending")
        ],
    )
    monkeypatch.setattr(
        revision_lifecycle, "_verify_index", lambda *_args, **_kwargs: None
    )
    with pytest.raises(admin_service.AdminUnavailable):
        admin_service.review_document(db, ACTOR, "doc-1", action="approve", reason=None)
