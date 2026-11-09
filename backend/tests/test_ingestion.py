"""Official document ingestion pipeline tests."""

import hashlib
import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import admin_ingestion
from utils import authorization
from utils.authorization import Actor, ActorKind
from utils.ingestion import security, service
from utils.ingestion.extraction import ExtractionResult
from utils.ingestion.security import FetchError, FetchResult, URLRejected

ACTOR = Actor(ActorKind.CITIZEN, "user_admin")
NOW = datetime.now(timezone.utc)
PDF = b"%PDF-1.4 ingestion-test"


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

    def delete(self):
        self.mode = "delete"
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
        if self.mode == "delete":
            keep = [row for row in rows if not self._matches(row)]
            self.db.tables[self.name] = keep
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=[dict(row) for row in rows if self._matches(row)])


class Storage:
    def __init__(self):
        self.uploads = {}
        self.fail_upload = False

    def from_(self, _bucket):
        return self

    def upload(self, path, content, _opts=None):
        if self.fail_upload:
            raise RuntimeError("storage down")
        self.uploads[path] = content

    def download(self, path):
        return self.uploads[path]


class DB:
    def __init__(self, tables=None):
        self.tables = {name: [dict(row) for row in rows] for name, rows in (tables or {}).items()}
        self.storage = Storage()

    def table(self, name):
        return Query(self, name)


def source(**overrides):
    row = {
        "source_id": "src-1",
        "issuing_organization": "Ministry",
        "source_type": "official_gov",
        "source_url": "https://agency.example.gov.my/documents",
        "verification_status": "verified",
        "usage_permitted": True,
        "usage_rights": "Public information with attribution.",
        "freshness_days": 365,
        "last_verified_at": (NOW - timedelta(days=1)).isoformat(),
        "revoked_at": None,
        "metadata": {},
    }
    row.update(overrides)
    return row


def base_db(**overrides):
    tables = {
        "lr_documents": [],
        "official_sources": [source()],
        "document_revisions": [],
        "publication_events": [],
        "admin_audit_log": [],
        "lr_admin_roles": [],
        "ingestion_candidates": [],
        "ingestion_jobs": [],
        "source_discovery_checkpoints": [],
    }
    tables.update(overrides)
    return DB(tables)


def extraction(**overrides):
    row = {
        "page_count": 3,
        "text_chars": 1200,
        "title": "Extracted title",
        "author": "Ministry",
        "language": "en",
        "ocr_required": False,
        "extraction_status": "complete",
        "extraction_method": "pypdf",
    }
    row.update(overrides)
    return ExtractionResult(**row)


def seed_candidate(db, **overrides):
    row = {
        "id": "cand-1",
        "source_id": "src-1",
        "external_id": "ext-1",
        "source_url": "https://agency.example.gov.my/a.pdf",
        "canonical_url": "https://agency.example.gov.my/a.pdf",
        "title": "Official guidance",
        "issuing_organization": "Ministry",
        "document_type": "pdf",
        "file_format": "pdf",
        "publication_date": (NOW - timedelta(days=2)).isoformat(),
        "status": "discovered",
        "discovered_at": NOW.isoformat(),
    }
    row.update(overrides)
    db.tables["ingestion_candidates"].append(row)
    return row


def seed_job(db, **overrides):
    row = {
        "id": "job-1",
        "job_type": "ingest",
        "source_id": "src-1",
        "candidate_id": "cand-1",
        "status": "queued",
        "progress": 0,
        "attempts": 0,
        "max_attempts": 3,
        "details": {"requested_by": "user_admin"},
        "created_at": NOW.isoformat(),
    }
    row.update(overrides)
    db.tables["ingestion_jobs"].append(row)
    return row


def patch_fetch(monkeypatch, *, content=PDF, extraction_result=None):
    monkeypatch.setattr(
        service,
        "_fetch_document",
        lambda url, src: FetchResult(content=content, final_url=url, status_code=200),
    )
    monkeypatch.setattr(
        service,
        "_extract_or_fail",
        lambda data: extraction_result or extraction(),
    )


def patch_index(monkeypatch, *, chunks=7, fail=False):
    calls = []

    def fake_index(document_id, revision, source_id, content, filename):
        calls.append((document_id, revision, source_id, content, filename))
        if fail:
            raise RuntimeError("embedding provider down")
        return {
            "chunk_count": chunks,
            "namespace": f"doc:{document_id}:rev:{revision}",
            "indexed_at": NOW.isoformat(),
        }

    monkeypatch.setattr(service, "_index_document", fake_index)
    return calls


# ---------------------------------------------------------------------------
# Source and URL security
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "overrides",
    [
        {"verification_status": "unverified"},
        {"usage_permitted": False},
        {"revoked_at": NOW.isoformat()},
        {"last_verified_at": (NOW - timedelta(days=400)).isoformat(), "freshness_days": 30},
    ],
)
def test_ingestion_requires_verified_permitted_fresh_source(overrides):
    with pytest.raises(service.IngestionValidationError):
        service.require_verified_source(source(**overrides), now=NOW)


@pytest.mark.parametrize(
    "url,hosts",
    [
        ("https://evil.example.com/file.pdf", {"agency.example.gov.my"}),
        ("http://agency.example.gov.my/file.pdf", {"agency.example.gov.my"}),
        ("https://127.0.0.1/file.pdf", {"127.0.0.1"}),
        ("https://localhost/file.pdf", {"localhost"}),
        ("file:///etc/passwd", {"agency.example.gov.my"}),
        ("https://user:pass@agency.example.gov.my/x.pdf", {"agency.example.gov.my"}),
    ],
)
def test_url_validation_rejects_ssrf_and_unapproved_hosts(url, hosts):
    with pytest.raises(URLRejected):
        security.validate_url(url, hosts)


def test_download_size_and_signature_validation():
    with pytest.raises(service.IngestionValidationError):
        service._store_download(b"<html>not a pdf</html>", 1000)
    with pytest.raises(service.IngestionValidationError):
        service._store_download(b"%PDF-" + b"x" * 100, 10)


def _dns(*addresses):
    import socket

    return lambda *_args, **_kwargs: [
        (socket.AF_INET6 if ":" in address else socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))
        for address in addresses
    ]


@pytest.mark.parametrize(
    "addresses,allowed",
    [
        (["93.184.216.34"], True),
        (["127.0.0.1"], False),
        (["10.0.0.5"], False),
        (["169.254.1.1"], False),
        (["::1"], False),
        (["fe80::1"], False),
        (["93.184.216.34", "10.0.0.5"], False),
    ],
)
def test_dns_resolution_rejects_non_public_and_mixed_answers(monkeypatch, addresses, allowed):
    monkeypatch.setattr(security.socket, "getaddrinfo", _dns(*addresses))
    if allowed:
        security.validate_url("https://agency.example.gov.my/a.pdf", {"agency.example.gov.my"})
    else:
        with pytest.raises(URLRejected):
            security.validate_url("https://agency.example.gov.my/a.pdf", {"agency.example.gov.my"})


class _FakeResponse:
    def __init__(self, status_code=200, content=b"", headers=None, url="https://agency.example.gov.my/a.pdf"):
        self.status_code = status_code
        self.content = content
        self.headers = headers or {}
        self.url = url


class _FakeClient:
    def __init__(self, responses, captured):
        self.responses = list(responses)
        self.captured = captured

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def build_request(self, method, url, headers=None, extensions=None):
        self.captured.append({"method": method, "url": url, "headers": headers, "extensions": extensions})
        return SimpleNamespace(url=url, headers=headers, extensions=extensions)

    def send(self, _request):
        return self.responses.pop(0)


def test_connection_is_pinned_to_validated_ip_with_host_and_sni(monkeypatch):
    monkeypatch.setattr(security.socket, "getaddrinfo", _dns("93.184.216.34"))
    captured = []
    monkeypatch.setattr(
        security.httpx,
        "Client",
        lambda **_kwargs: _FakeClient([_FakeResponse(content=b"%PDF-1.4")], captured),
    )
    # robots.txt is fetched first.
    monkeypatch.setattr(security, "_robots_allowed", lambda *_args: True)

    result = security._request(
        "https://agency.example.gov.my/a.pdf",
        {"agency.example.gov.my"},
        max_bytes=100,
    )

    assert result.content == b"%PDF-1.4"
    request = captured[0]
    assert request["url"].startswith("https://93.184.216.34/")
    assert request["headers"]["Host"] == "agency.example.gov.my"
    assert request["extensions"] == {"sni_hostname": "agency.example.gov.my"}


def test_redirect_to_unapproved_or_private_host_is_rejected(monkeypatch):
    monkeypatch.setattr(security.socket, "getaddrinfo", _dns("93.184.216.34"))
    monkeypatch.setattr(security, "_robots_allowed", lambda *_args: True)
    captured = []
    monkeypatch.setattr(
        security.httpx,
        "Client",
        lambda **_kwargs: _FakeClient(
            [
                _FakeResponse(
                    status_code=302,
                    headers={"location": "https://evil.example.com/a.pdf"},
                )
            ],
            captured,
        ),
    )
    with pytest.raises(URLRejected):
        security._request(
            "https://agency.example.gov.my/a.pdf",
            {"agency.example.gov.my"},
            max_bytes=100,
        )
    assert len(captured) == 1


def test_response_size_limit_and_timeout(monkeypatch):
    monkeypatch.setattr(security.socket, "getaddrinfo", _dns("93.184.216.34"))
    monkeypatch.setattr(security, "_robots_allowed", lambda *_args: True)
    monkeypatch.setattr(
        security.httpx,
        "Client",
        lambda **_kwargs: _FakeClient(
            [_FakeResponse(content=b"%PDF-" + b"x" * 200, headers={"content-length": "205"})],
            [],
        ),
    )
    with pytest.raises(FetchError):
        security._request(
            "https://agency.example.gov.my/a.pdf",
            {"agency.example.gov.my"},
            max_bytes=100,
        )

    class TimeoutClient(_FakeClient):
        def send(self, _request):
            raise security.httpx.TimeoutException("slow")

    monkeypatch.setattr(
        security.httpx, "Client", lambda **_kwargs: TimeoutClient([], [])
    )
    with pytest.raises(security.httpx.TimeoutException):
        security._request(
            "https://agency.example.gov.my/a.pdf",
            {"agency.example.gov.my"},
            max_bytes=100,
        )


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


def test_discovery_creates_candidates_and_is_idempotent(monkeypatch):
    db = base_db()
    html = (
        '<html><body><a href="/a.pdf">Document A</a>'
        '<a href="/b.pdf">Document B</a>'
        '<a href="/page.html">Not a PDF</a></body></html>'
    )
    monkeypatch.setattr(
        service,
        "_fetch_listing",
        lambda url, src: FetchResult(content=html.encode(), final_url=str(src["source_url"]), status_code=200),
    )
    job = service.start_discovery(db, ACTOR, "src-1")
    service.run_discovery(db, job["id"])
    assert len(db.tables["ingestion_candidates"]) == 2
    assert db.tables["ingestion_jobs"][0]["status"] == "completed"
    assert db.tables["source_discovery_checkpoints"][0]["source_id"] == "src-1"

    again = service.start_discovery(db, ACTOR, "src-1")
    service.run_discovery(db, again["id"])
    assert len(db.tables["ingestion_candidates"]) == 2


# ---------------------------------------------------------------------------
# Ingest lifecycle
# ---------------------------------------------------------------------------


def test_new_document_is_ingested_private_and_unpublished(monkeypatch):
    db = base_db()
    seed_candidate(db)
    job = seed_job(db)
    patch_fetch(monkeypatch)
    index_calls = patch_index(monkeypatch)

    service.run_ingest(db, job["id"])

    assert len(db.tables["lr_documents"]) == 1
    document = db.tables["lr_documents"][0]
    assert document["visibility_scope"] == "private"
    assert document["publication_status"] == "draft"
    assert document["approved_by"] is None
    assert document["published_at"] is None
    assert document["status"] == "ready"
    assert document["checksum"] == hashlib.sha256(PDF).hexdigest()
    assert document["page_count"] == 3
    assert len(index_calls) == 1

    revision = db.tables["document_revisions"][0]
    assert revision["revision"] == 1
    assert revision["approved_by"] is None
    assert revision["checksum"] == document["checksum"]

    assert db.tables["ingestion_candidates"][0]["status"] == "ingested"
    assert db.tables["ingestion_jobs"][0]["status"] == "completed"
    assert db.tables["publication_events"] == []
    assert any(row["action"] == "document.ingest" for row in db.tables["admin_audit_log"])
    assert db.storage.uploads


def test_unchanged_document_is_not_duplicated(monkeypatch):
    checksum = hashlib.sha256(PDF).hexdigest()
    db = base_db(
        lr_documents=[
            {
                "id": "doc-1",
                "name": "Existing",
                "source_id": "src-1",
                "source_url": "https://agency.example.gov.my/a.pdf",
                "current_revision": 1,
                "document_version": 1,
                "status": "ready",
                "visibility_scope": "published",
                "publication_status": "published",
            }
        ],
        document_revisions=[{"document_id": "doc-1", "revision": 1, "checksum": checksum, "approved_by": "u"}],
    )
    seed_candidate(db)
    job = seed_job(db)
    patch_fetch(monkeypatch)
    patch_index(monkeypatch)

    service.run_ingest(db, job["id"])

    assert len(db.tables["lr_documents"]) == 1
    assert len(db.tables["document_revisions"]) == 1
    assert db.tables["ingestion_candidates"][0]["status"] == "unchanged"
    assert db.tables["ingestion_jobs"][0]["status"] == "completed"


def test_changed_content_creates_pending_revision_without_replacing_current(monkeypatch):
    db = base_db(
        lr_documents=[
            {
                "id": "doc-1",
                "name": "Existing",
                "source_id": "src-1",
                "source_url": "https://agency.example.gov.my/a.pdf",
                "current_revision": 1,
                "document_version": 1,
                "status": "ready",
                "visibility_scope": "public",
                "publication_status": "published",
            }
        ],
        document_revisions=[
            {"document_id": "doc-1", "revision": 1, "checksum": "old-checksum", "approved_by": "u"}
        ],
    )
    seed_candidate(db)
    job = seed_job(db)
    patch_fetch(monkeypatch)
    index_calls = patch_index(monkeypatch, chunks=9)

    service.run_ingest(db, job["id"])

    revisions = db.tables["document_revisions"]
    assert len(revisions) == 2
    pending = [rev for rev in revisions if rev["revision"] == 2][0]
    assert pending["approved_by"] is None
    assert pending["review_status"] == "pending"
    assert pending["indexing_status"] == "indexed"
    assert pending["chunk_count"] == 9
    assert pending["index_namespace"] == "doc:doc-1:rev:2"
    assert pending["metadata"]["requires_review"] is True
    assert db.tables["lr_documents"][0]["current_revision"] == 1
    assert db.tables["ingestion_candidates"][0]["revision"] == 2
    assert db.tables["ingestion_jobs"][0]["stage"] == "review_required"
    assert len(index_calls) == 1
    assert index_calls[0][1] == 2


def test_ocr_required_document_is_not_indexed(monkeypatch):
    db = base_db()
    seed_candidate(db)
    job = seed_job(db)
    patch_fetch(monkeypatch, extraction_result=extraction(ocr_required=True, extraction_status="ocr_required", text_chars=0))
    monkeypatch.setattr(service, "_index_document", lambda *_args: pytest.fail("OCR document must not be indexed"))

    service.run_ingest(db, job["id"])

    document = db.tables["lr_documents"][0]
    assert document["visibility_scope"] == "private"
    assert document["publication_status"] == "draft"
    assert document["ocr_required"] is True
    assert db.tables["ingestion_candidates"][0]["status"] == "ocr_required"
    assert db.tables["ingestion_jobs"][0]["stage"] == "ocr_required"


def test_invalid_file_fails_job_and_candidate(monkeypatch):
    db = base_db()
    seed_candidate(db)
    job = seed_job(db)
    monkeypatch.setattr(
        service,
        "_fetch_document",
        lambda url, src: FetchResult(content=b"<html>fake</html>", final_url=url, status_code=200),
    )
    service.run_ingest(db, job["id"])
    assert db.tables["lr_documents"] == []
    assert db.tables["ingestion_candidates"][0]["status"] == "failed"
    assert db.tables["ingestion_jobs"][0]["status"] == "failed"


def test_indexing_failure_leaves_document_private_and_failed(monkeypatch):
    db = base_db()
    seed_candidate(db)
    job = seed_job(db)
    patch_fetch(monkeypatch)
    patch_index(monkeypatch, fail=True)

    service.run_ingest(db, job["id"])

    assert db.tables["lr_documents"][0]["status"] == "error"
    assert db.tables["lr_documents"][0]["visibility_scope"] == "private"
    assert db.tables["lr_documents"][0]["publication_status"] == "draft"
    assert db.tables["ingestion_jobs"][0]["status"] == "failed"


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


def test_active_job_prevents_duplicate_concurrent_work():
    db = base_db()
    seed_candidate(db)
    first = service.start_ingest(db, ACTOR, "cand-1")
    second = service.start_ingest(db, ACTOR, "cand-1")
    assert first["id"] == second["id"]
    assert len(db.tables["ingestion_jobs"]) == 1


def test_claim_is_atomic_and_second_claim_loses():
    db = base_db()
    seed_job(db)
    first = service._claim_job(db, "job-1")
    second = service._claim_job(db, "job-1")
    assert first is not None
    assert second is None


def test_retry_is_bounded_and_cancel_only_queued():
    db = base_db()
    seed_job(db, status="failed", attempts=3, max_attempts=3)
    with pytest.raises(service.IngestionConflict):
        service.retry_job(db, ACTOR, "job-1")

    db2 = base_db()
    seed_job(db2)
    cancelled = service.cancel_job(db2, ACTOR, "job-1")
    assert cancelled["status"] == "cancelled"


def test_html_connector_supports_multiple_listing_pages():
    from utils.ingestion.connectors import HtmlListingConnector

    source_row = source(
        metadata={
            "page_url_template": "https://agency.example.gov.my/list/{page}",
            "max_pages": 2,
        }
    )
    seen: list[str] = []

    def fetch(url):
        seen.append(url)
        page = url.rsplit("/", 1)[-1]
        return FetchResult(
            content=f'<a href="/doc-{page}.pdf">Doc {page}</a>'.encode(),
            final_url=url,
            status_code=200,
        )

    documents = HtmlListingConnector().discover_documents(source_row, fetch)
    assert seen == [
        "https://agency.example.gov.my/list/1",
        "https://agency.example.gov.my/list/2",
    ]
    assert {doc.source_url for doc in documents} == {
        "https://agency.example.gov.my/doc-1.pdf",
        "https://agency.example.gov.my/doc-2.pdf",
    }


def test_rss_connector_reads_pdf_enclosures():
    from utils.ingestion.connectors import RssFeedConnector

    feed = b"""<?xml version="1.0"?>
    <rss><channel><item>
      <title>Guideline 2026</title>
      <link>https://agency.example.gov.my/guideline</link>
      <enclosure url="https://agency.example.gov.my/guideline.pdf" type="application/pdf" />
      <pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate>
    </item></channel></rss>"""
    source_row = source(source_type="rss_feed")
    documents = RssFeedConnector().discover_documents(
        source_row,
        lambda url: FetchResult(content=feed, final_url=url, status_code=200),
    )
    assert len(documents) == 1
    assert documents[0].source_url.endswith("/guideline.pdf")
    assert documents[0].title == "Guideline 2026"


def test_discovery_rejects_unverified_source():
    db = base_db(official_sources=[source(verification_status="unverified")])
    with pytest.raises(service.IngestionValidationError):
        service.start_discovery(db, ACTOR, "src-1")


def test_skip_candidate_records_reason_and_audit():
    db = base_db()
    seed_candidate(db)
    result = service.skip_candidate(db, ACTOR, "cand-1", "Not an official publication")
    assert result["status"] == "skipped"
    assert result["skip_reason"] == "Not an official publication"
    assert any(row["action"] == "ingestion.candidate_skip" for row in db.tables["admin_audit_log"])


def test_stale_running_job_is_recovered_for_retry():
    db = base_db()
    seed_job(
        db,
        status="running",
        started_at=(NOW - timedelta(minutes=30)).isoformat(),
        attempts=1,
    )
    assert service.recover_stale_jobs(db) == 1
    assert db.tables["ingestion_jobs"][0]["status"] == "failed"
    assert "lease expired" in db.tables["ingestion_jobs"][0]["error_message"].lower()


def test_worker_claim_is_atomic_and_sets_lease():
    db = base_db()
    seed_job(db)
    job = service.claim_next_job(db, "worker-1", lease_seconds=60)
    assert job["status"] == "running"
    assert job["worker_id"] == "worker-1"
    assert job["attempts"] == 1
    assert db.tables["ingestion_jobs"][0]["lease_expires_at"]
    assert service.claim_next_job(db, "worker-2") is None


def test_running_cancel_is_cooperative():
    db = base_db()
    seed_job(db, status="running", worker_id="w", lease_expires_at=(NOW + timedelta(minutes=5)).isoformat())
    job = service.cancel_job(db, ACTOR, "job-1")
    assert job["status"] == "running"
    assert job["cancel_requested"] is True
    assert db.tables["ingestion_jobs"][0]["status"] == "running"


def test_retry_schedules_backoff_and_clears_lease():
    db = base_db()
    seed_job(db, status="failed", attempts=2, worker_id="w", lease_expires_at=NOW.isoformat())
    job = service.retry_job(db, ACTOR, "job-1")
    assert job["status"] == "queued"
    assert job["worker_id"] is None
    assert job["next_retry_at"]
    assert service.claim_next_job(db, "worker-1") is None  # not due yet


def test_expired_worker_cannot_overwrite_newer_worker():
    db = base_db()
    seed_job(
        db,
        status="running",
        worker_id="new-worker",
        lease_expires_at=(NOW + timedelta(minutes=20)).isoformat(),
    )
    service._job_workers["job-1"] = "old-worker"
    finished = service._finish_job(db, "job-1", {"stale": True})
    assert finished is False
    assert db.tables["ingestion_jobs"][0]["status"] == "running"
    assert db.tables["ingestion_jobs"][0]["worker_id"] == "new-worker"


def test_cancelled_job_does_not_index(monkeypatch):
    db = base_db()
    seed_candidate(db)
    seed_job(db, cancel_requested=True)
    patch_fetch(monkeypatch)
    monkeypatch.setattr(service, "_index_document", lambda *_args: pytest.fail("cancelled job indexed"))
    service.run_ingest(db, "job-1")
    assert db.tables["ingestion_jobs"][0]["status"] == "cancelled"
    assert db.tables["lr_documents"] == []


# ---------------------------------------------------------------------------
# Integration and publication isolation
# ---------------------------------------------------------------------------


def test_full_pipeline_stops_before_review(monkeypatch):
    db = base_db()
    html = '<a href="/a.pdf">Document A</a>'
    monkeypatch.setattr(
        service,
        "_fetch_listing",
        lambda url, src: FetchResult(content=html.encode(), final_url=str(src["source_url"]), status_code=200),
    )
    monkeypatch.setattr(
        service,
        "_fetch_document",
        lambda url, src: FetchResult(content=PDF, final_url=url, status_code=200),
    )
    monkeypatch.setattr(service, "_extract_or_fail", lambda data: extraction())
    patch_index(monkeypatch)

    discovery = service.start_discovery(db, ACTOR, "src-1")
    service.run_discovery(db, discovery["id"])
    candidate = db.tables["ingestion_candidates"][0]
    ingest = service.start_ingest(db, ACTOR, candidate["id"])
    service.run_ingest(db, ingest["id"])

    document = db.tables["lr_documents"][0]
    assert document["publication_status"] == "draft"
    assert document["visibility_scope"] == "private"
    assert document["published_at"] is None

    from utils import admin_service, eligibility

    queue = admin_service.review_queue(db, ACTOR)
    assert [item["id"] for item in queue] == [document["id"]]
    snapshot = eligibility.EligibilitySnapshot(approved_sources={}, revisions_by_document={})
    assert eligibility.is_document_public(document, snapshot) is False
    assert db.tables["publication_events"] == []


# ---------------------------------------------------------------------------
# Endpoint authorization
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    application = FastAPI()
    application.include_router(admin_ingestion.router, prefix="/api/v1/admin/ingestion")
    application.include_router(admin_ingestion.documents_router, prefix="/api/v1/admin/documents")
    return application


def test_admin_ingestion_rejects_anonymous(app):
    with TestClient(app) as client:
        assert client.get("/api/v1/admin/ingestion/overview").status_code == 401
        assert client.get("/api/v1/admin/ingestion/candidates").status_code == 401


def test_admin_ingestion_requires_permission(app, monkeypatch):
    from utils.authorization import get_actor

    app.dependency_overrides[get_actor] = lambda: ACTOR
    monkeypatch.setattr(authorization, "resolve_permissions", lambda actor: frozenset())
    with TestClient(app) as client:
        assert client.get("/api/v1/admin/ingestion/overview").status_code == 403


def test_admin_ingestion_role_provider_unavailable_is_503(app, monkeypatch):
    from utils.authorization import get_actor

    app.dependency_overrides[get_actor] = lambda: ACTOR

    def unavailable(_actor):
        raise authorization.RoleSourceUnavailable("down")

    monkeypatch.setattr(authorization, "resolve_permissions", unavailable)
    with TestClient(app) as client:
        assert client.get("/api/v1/admin/ingestion/overview").status_code == 503
