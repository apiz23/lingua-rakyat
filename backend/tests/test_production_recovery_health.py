"""Readiness must fail when the public catalogue client cannot reach the database."""

import os
import sys
from types import SimpleNamespace

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import main


class OkQuery:
    def table(self, *_args):
        return self

    def select(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        return SimpleNamespace(data=[{"id": "any"}])


def test_liveness_does_not_depend_on_the_database(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_supabase",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("database down")),
    )
    with TestClient(main.app) as client:
        response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_reports_ok_when_catalogue_is_reachable(monkeypatch):
    monkeypatch.setattr(main, "get_supabase", lambda **_kwargs: OkQuery())
    with TestClient(main.app) as client:
        response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "catalogue": "anon"},
    }


def test_readiness_reports_service_fallback_when_anon_key_is_unusable(monkeypatch):
    def factory(admin=False):
        if not admin:
            raise ValueError("invalid SUPABASE_ANON_KEY")
        return OkQuery()

    monkeypatch.setattr(main, "get_supabase", factory)
    with TestClient(main.app) as client:
        response = client.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["catalogue"] == "service-fallback"
    assert body["checks"]["anon_key"] in {"jwt", "publishable", "unknown", "missing"}
    assert body["checks"]["anon_error"] == "ValueError"


def test_readiness_fails_closed_without_leaking_configuration(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_supabase",
        lambda **_kwargs: (_ for _ in ()).throw(ValueError("SUPABASE_ANON_KEY missing")),
    )
    with TestClient(main.app) as client:
        response = client.get("/health/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["checks"]["database"] == "unavailable"
    assert body["checks"]["catalogue"] == "service-fallback"
    assert body["checks"]["anon_key"] in {"jwt", "publishable", "unknown", "missing"}
    assert body["checks"]["anon_error"] == "ValueError"
    assert "SUPABASE_ANON_KEY" not in response.text


def test_root_health_stays_backward_compatible(monkeypatch):
    monkeypatch.setattr(
        main,
        "get_supabase",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("database down")),
    )
    with TestClient(main.app) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
