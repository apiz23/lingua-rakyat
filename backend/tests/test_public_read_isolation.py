import os
import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import documents, eval as eval_router, telegram


class ReadOnlyQuery:
    def __init__(self, rows, operations):
        self.rows = rows
        self.operations = operations

    def select(self, *_args, **_kwargs):
        self.operations.append("select")
        return self

    def order(self, *_args, **_kwargs):
        self.operations.append("order")
        return self

    def execute(self):
        self.operations.append("execute")
        return SimpleNamespace(data=self.rows)

    def insert(self, *_args, **_kwargs):
        raise AssertionError("public catalogue attempted insert")

    def upsert(self, *_args, **_kwargs):
        raise AssertionError("public catalogue attempted upsert")

    def update(self, *_args, **_kwargs):
        raise AssertionError("public catalogue attempted update")

    def delete(self, *_args, **_kwargs):
        raise AssertionError("public catalogue attempted delete")


class ReadOnlySupabase:
    def __init__(self, rows, operations):
        self.rows = rows
        self.operations = operations

    def table(self, _name):
        return ReadOnlyQuery(self.rows, self.operations)


@pytest.fixture
def client():
    app = FastAPI()
    app.state.limiter = documents.limiter
    app.include_router(documents.router, prefix="/api/documents")
    app.include_router(telegram.router, prefix="/api/telegram")
    app.include_router(telegram.machine_v1_router, prefix="/api/v1/machine")
    app.include_router(eval_router.router, prefix="/api/eval")
    with TestClient(app) as test_client:
        yield test_client


def test_public_document_catalogue_is_read_only_and_does_not_reconcile(client, monkeypatch):
    rows = [{
        "id": "public-doc-1",
        "name": "Public information.pdf",
        "size_bytes": 123,
        "chunk_count": 4,
        "status": "ready",
        "uploaded_at": "2026-01-01T00:00:00+00:00",
        "storage_path": "public-doc-1/file.pdf",
        "public_url": "https://example.test/file.pdf",
        "agency": "JPN",
    }]
    accesses = []
    operations = []

    def get_supabase(*, admin=False):
        accesses.append(admin)
        assert admin is False, "public catalogue must not acquire service-role client"
        return ReadOnlySupabase(rows, operations)

    monkeypatch.setattr(documents, "get_supabase", get_supabase)
    monkeypatch.setattr(
        documents,
        "sync_documents_with_storage",
        lambda _docs: pytest.fail("public catalogue invoked storage reconciliation"),
    )

    response = client.get("/api/documents/")

    assert response.status_code == 200
    assert [doc["id"] for doc in response.json()] == ["public-doc-1"]
    assert accesses == [False]
    assert operations == ["select", "order", "execute"]


def test_public_document_catalogue_reports_unavailable_database(client, monkeypatch):
    monkeypatch.setattr(
        documents,
        "get_supabase",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("unavailable")),
    )
    monkeypatch.setattr(
        documents,
        "sync_documents_with_storage",
        lambda _docs: pytest.fail("unavailable catalogue attempted reconciliation"),
    )

    response = client.get("/api/documents/")

    # An empty library and an unreachable catalogue must not look identical to
    # the client. 503 lets the UI show an outage instead of "upload your first
    # PDF" while production documents exist.
    assert response.status_code == 503
    assert response.json()["detail"] == "Document catalogue is temporarily unavailable."


def test_refresh_chunks_is_disabled_before_database_or_pinecone_access(client, monkeypatch):
    client_accesses = []
    monkeypatch.setattr(
        documents,
        "get_supabase",
        lambda **kwargs: client_accesses.append(kwargs),
    )
    monkeypatch.setattr(
        documents,
        "load_documents",
        lambda: pytest.fail("disabled refresh loaded documents"),
    )
    monkeypatch.setattr(
        documents,
        "upsert_documents",
        lambda _rows: pytest.fail("disabled refresh attempted document write"),
    )

    unauthenticated = client.post("/api/documents/refresh-chunks")
    bearer_only = client.post(
        "/api/documents/refresh-chunks",
        headers={"Authorization": "Bearer signed-in-citizen-token"},
    )

    assert unauthenticated.status_code == 503
    assert bearer_only.status_code == 503
    assert unauthenticated.json() == bearer_only.json()
    assert client_accesses == []


@pytest.mark.parametrize("method,path,kwargs", [
    ("post", "/api/documents/verify-token?token=shared-value", {}),
    ("post", "/api/documents/register?id=d1&name=Doc", {}),
    ("delete", "/api/documents/d1?upload_token=shared-value", {}),
    ("patch", "/api/documents/d1/rename", {"json": {"name": "New.pdf", "upload_token": "shared-value"}}),
    ("post", "/api/documents/d1/reindex?upload_token=shared-value", {}),
    ("post", "/api/documents/seed?upload_token=shared-value", {}),
    ("post", "/api/documents/upload?upload_token=shared-value", {
        "files": {"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
    }),
])
def test_document_administration_is_disabled_without_trusted_operator_role(
    client, monkeypatch, method, path, kwargs
):
    acquisitions = []
    monkeypatch.setattr(
        documents,
        "get_supabase",
        lambda **options: acquisitions.append(options),
    )
    monkeypatch.setattr(
        documents,
        "verify_upload_token",
        lambda _token: pytest.fail("shared token was treated as operator authorization"),
    )

    response = getattr(client, method)(path, **kwargs)

    assert response.status_code == 503
    assert response.json()["detail"] == "Document administration is temporarily unavailable."
    assert acquisitions == []


def test_telegram_setup_is_disabled_and_ignores_untrusted_host(client, monkeypatch):
    calls = []
    monkeypatch.setattr(telegram, "BOT_TOKEN", "test-token")
    monkeypatch.setattr(telegram, "_bot", lambda: SimpleNamespace(
        set_webhook=lambda **kwargs: calls.append(kwargs)
    ))

    response = client.get(
        "/api/telegram/setup",
        headers={"Host": "attacker.invalid", "X-Forwarded-Host": "attacker.invalid"},
    )

    assert response.status_code == 503
    assert "attacker.invalid" not in response.text
    assert calls == []


def test_telegram_document_command_uses_catalogue_without_reconciliation(monkeypatch):
    expected = [{"id": "d1", "name": "Public document"}]
    monkeypatch.setattr(telegram, "load_documents", lambda: expected)

    assert telegram._get_docs() == expected


def test_telegram_webhook_callbacks_still_accept_authenticated_machine_requests(monkeypatch, client):
    handler = AsyncMock()
    fake_telegram = ModuleType("telegram")
    fake_telegram.Update = type(
        "FakeUpdate",
        (),
        {"de_json": staticmethod(lambda _data, _bot: SimpleNamespace(
            message=object(), callback_query=None
        ))},
    )
    monkeypatch.setitem(sys.modules, "telegram", fake_telegram)
    monkeypatch.setattr(telegram, "BOT_TOKEN", "test-token")
    monkeypatch.setattr(telegram, "_get_webhook_secret", lambda: "expected-secret")
    monkeypatch.setattr(telegram, "_bot", lambda: object())
    monkeypatch.setattr(telegram, "_handle_message", handler)

    for path in ("/api/telegram/webhook", "/api/v1/machine/telegram/webhook"):
        response = client.post(
            path,
            json={"update_id": 1},
            headers={"X-Telegram-Bot-Api-Secret-Token": "expected-secret"},
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True}
    assert handler.await_count == 2


@pytest.mark.parametrize("method,path,payload", [
    ("post", "/api/eval/record", {"question": "q", "answer": "a"}),
    ("post", "/api/eval/run-test-suite", {"document_id": "d1"}),
    ("post", "/api/eval/run-test-suite-stream", {"document_id": "d1"}),
    ("post", "/api/eval/augment-query", {"query": "q"}),
    ("delete", "/api/eval/clear?upload_token=shared-value", None),
])
def test_evaluation_writes_and_provider_operations_fail_closed(client, monkeypatch, method, path, payload):
    calls = []
    monkeypatch.setattr(eval_router._evaluator, "record", lambda **_kw: calls.append("record"))
    monkeypatch.setattr(eval_router._evaluator, "clear", lambda: calls.append("clear"))
    monkeypatch.setattr(eval_router, "answer_question", lambda **_kw: calls.append("answer"))
    monkeypatch.setattr(eval_router, "_get_augmenter", lambda: calls.append("augmenter"))
    monkeypatch.setattr(
        "utils.auth.get_supabase",
        lambda **_kw: calls.append("supabase"),
    )

    response = getattr(client, method)(path, json=payload) if payload is not None else getattr(client, method)(path)

    assert response.status_code == 503
    assert calls == []


@pytest.mark.parametrize("path", [
    "/api/eval/report",
    "/api/eval/health",
    "/api/eval/data-quality",
    "/api/eval/simplify-demo",
])
def test_internal_evaluation_reads_are_unavailable_without_researcher_authorization(
    client, monkeypatch, path
):
    calls = []
    monkeypatch.setattr(eval_router._evaluator, "report", lambda: calls.append("report"))
    monkeypatch.setattr(eval_router, "rouge_n", lambda *_args, **_kwargs: calls.append("health"))
    monkeypatch.setattr(eval_router, "simplify_jargon", lambda *_args, **_kwargs: calls.append("simplify"))
    monkeypatch.setattr(
        "utils.data_augmentation.generate_data_quality_report",
        lambda *_args, **_kwargs: calls.append("quality"),
    )

    response = client.get(path)

    assert response.status_code == 503
    assert response.json()["detail"] == "Evaluation operations are temporarily unavailable."
    assert calls == []
