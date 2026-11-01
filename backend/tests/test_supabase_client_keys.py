import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture(autouse=True)
def reset_supabase_clients(monkeypatch):
    import utils.auth as auth

    monkeypatch.setattr(auth, "_supabase", None)
    monkeypatch.setattr(auth, "_supabase_admin", None)
    yield
    auth._supabase = None
    auth._supabase_admin = None


def test_public_client_uses_only_anon_key(monkeypatch):
    import utils.auth as auth

    calls = []
    expected_client = object()
    monkeypatch.setenv("SUPABASE_URL", "https://database.example.test")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-key")
    monkeypatch.setenv("SUPABASE_KEY", "service-role-key")
    monkeypatch.setattr(
        auth,
        "create_client",
        lambda url, key: calls.append((url, key)) or expected_client,
    )

    assert auth.get_supabase() is expected_client
    assert calls == [("https://database.example.test", "public-anon-key")]


def test_public_client_fails_closed_when_anon_key_is_missing(monkeypatch):
    import utils.auth as auth

    calls = []
    monkeypatch.setenv("SUPABASE_URL", "https://database.example.test")
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_KEY", "service-role-key")
    monkeypatch.setattr(
        auth,
        "create_client",
        lambda url, key: calls.append((url, key)),
    )

    with pytest.raises(ValueError, match="SUPABASE_ANON_KEY must be set"):
        auth.get_supabase()

    assert calls == []


def test_admin_client_continues_to_use_service_role_key(monkeypatch):
    import utils.auth as auth

    calls = []
    expected_client = object()
    monkeypatch.setenv("SUPABASE_URL", "https://database.example.test")
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_KEY", "service-role-key")
    monkeypatch.setattr(
        auth,
        "create_client",
        lambda url, key: calls.append((url, key)) or expected_client,
    )

    assert auth.get_supabase(admin=True) is expected_client
    assert calls == [("https://database.example.test", "service-role-key")]


@pytest.mark.parametrize("admin,missing", [(False, "SUPABASE_URL"), (False, "SUPABASE_ANON_KEY"), (True, "SUPABASE_URL"), (True, "SUPABASE_KEY")])
def test_missing_or_empty_configuration_never_constructs_client(monkeypatch, admin, missing):
    import utils.auth as auth

    monkeypatch.setenv("SUPABASE_URL", "https://database.example.test")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-key")
    monkeypatch.setenv("SUPABASE_KEY", "service-role-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "alternative-admin-key")
    monkeypatch.setenv(missing, "")

    def unexpected_client(*args):
        pytest.fail("Missing configuration must fail before constructing a client")

    monkeypatch.setattr(auth, "create_client", unexpected_client)
    with pytest.raises(ValueError):
        auth.get_supabase(admin=admin)


def test_admin_and_public_clients_are_cached_separately(monkeypatch):
    import utils.auth as auth

    monkeypatch.setenv("SUPABASE_URL", "https://database.example.test")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-key")
    monkeypatch.setenv("SUPABASE_KEY", "service-role-key")
    calls = []

    def create_client(url, key):
        client = object()
        calls.append((key, client))
        return client

    monkeypatch.setattr(auth, "create_client", create_client)
    admin = auth.get_supabase(admin=True)
    public = auth.get_supabase()
    assert admin is not public
    assert auth.get_supabase() is public
    assert auth.get_supabase(admin=True) is admin
    assert [key for key, _ in calls] == ["service-role-key", "public-anon-key"]


def test_cached_admin_client_cannot_satisfy_missing_public_key(monkeypatch):
    import utils.auth as auth

    monkeypatch.setenv("SUPABASE_URL", "https://database.example.test")
    monkeypatch.setenv("SUPABASE_KEY", "service-role-key")
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setattr(auth, "create_client", lambda url, key: object())
    auth.get_supabase(admin=True)
    with pytest.raises(ValueError):
        auth.get_supabase()
