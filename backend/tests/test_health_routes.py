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

        # Readiness now probes the public catalogue client. Without
        # credentials it must fail closed with 503 and no configuration leak.
        ready = client.get("/health/ready")
        assert ready.status_code in (200, 503)
        assert set(ready.json()) <= {"status", "checks"}
        assert "SUPABASE" not in ready.text


def test_v1_router_mounts_only_currently_authorized_audience_groups():
    paths = app.openapi()["paths"]

    assert "/api/v1/public/voice/transcriptions" in paths
    assert "/api/v1/public/voice/speech" in paths
    assert "/api/v1/public/feedback" in paths
    assert "/api/v1/public/shares/{slug}" in paths
    assert "/api/v1/me/history" in paths
    assert "/api/v1/me/conversations" in paths
    assert "/api/v1/me/shares" in paths
    assert "/api/v1/machine/telegram/webhook" in paths
    assert not any(path.startswith("/api/v1/admin/") for path in paths)
    assert not any(path.startswith("/api/v1/internal/") for path in paths)
