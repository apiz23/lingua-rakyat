import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app


def test_health_endpoints_return_only_minimal_status():
    with TestClient(app) as client:
        for path in ("/", "/health/live"):
            response = client.get(path)
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}



        ready = client.get("/health/ready")
        assert ready.status_code in (200, 503)
        assert set(ready.json()) <= {"status", "checks"}
        assert "SUPABASE" not in ready.text


def test_v1_router_mounts_audience_groups_with_privileged_admin():
    paths = app.openapi()["paths"]

    assert "/api/v1/public/voice/transcriptions" in paths
    assert "/api/v1/public/voice/speech" in paths
    assert "/api/v1/public/feedback" in paths
    assert "/api/v1/public/shares/{slug}" in paths
    assert "/api/v1/me/history" in paths
    assert "/api/v1/me/conversations" in paths
    assert "/api/v1/me/shares" in paths
    assert "/api/v1/machine/telegram/webhook" in paths
    assert "/api/v1/admin/dashboard" in paths
    assert "/api/v1/admin/documents" in paths
    assert "/api/v1/admin/review-queue" in paths
    assert "/api/v1/admin/audit-logs" in paths
    assert not any(path.startswith("/api/v1/internal/") for path in paths)


    with TestClient(app) as client:
        for path in (
            "/api/v1/admin/dashboard",
            "/api/v1/admin/documents",
            "/api/v1/admin/audit-logs",
        ):
            assert client.get(path).status_code == 401
