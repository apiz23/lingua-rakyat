import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

import pytest
from fastapi import HTTPException

from auth_helpers import TEST_ISSUER, install_fake_jwks, make_keypair, mint_token

PRIVATE_KEY, PUBLIC_KEY = make_keypair()


class FakeRequest:
    def __init__(self, auth_header=None):
        self.headers = {}
        if auth_header is not None:
            self.headers["authorization"] = auth_header


def test_valid_token_returns_sub(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    from utils.auth import get_verified_user
    token = mint_token(PRIVATE_KEY, sub="user_abc")
    assert get_verified_user(FakeRequest(f"Bearer {token}")) == "user_abc"


def test_no_header_returns_none(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    from utils.auth import get_verified_user
    assert get_verified_user(FakeRequest()) is None


def test_expired_token_401(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    from utils.auth import get_verified_user
    token = mint_token(PRIVATE_KEY, expires_in=-60)
    with pytest.raises(HTTPException) as exc:
        get_verified_user(FakeRequest(f"Bearer {token}"))
    assert exc.value.status_code == 401


def test_wrong_issuer_401(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    from utils.auth import get_verified_user
    token = mint_token(PRIVATE_KEY, issuer="https://evil.example.com")
    with pytest.raises(HTTPException) as exc:
        get_verified_user(FakeRequest(f"Bearer {token}"))
    assert exc.value.status_code == 401


def test_garbage_token_401(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    from utils.auth import get_verified_user
    with pytest.raises(HTTPException) as exc:
        get_verified_user(FakeRequest("Bearer not-a-jwt"))
    assert exc.value.status_code == 401


def test_missing_sub_401(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    from utils.auth import get_verified_user
    token = mint_token(PRIVATE_KEY, sub="")
    with pytest.raises(HTTPException) as exc:
        get_verified_user(FakeRequest(f"Bearer {token}"))
    assert exc.value.status_code == 401


def test_jwks_unreachable_503(monkeypatch):
    import utils.auth as auth
    monkeypatch.setattr(auth, "CLERK_ISSUER", TEST_ISSUER)

    def boom():
        raise auth.jwt.exceptions.PyJWKClientConnectionError("no network")

    monkeypatch.setattr(auth, "_get_jwk_client", boom)
    token = mint_token(PRIVATE_KEY)
    with pytest.raises(HTTPException) as exc:
        auth.get_verified_user(FakeRequest(f"Bearer {token}"))
    assert exc.value.status_code == 503


def test_authorized_party_is_required_when_configured(monkeypatch):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    monkeypatch.setenv("CLERK_AUTHORIZED_PARTIES", "https://app.example.test")
    from utils.auth import get_verified_user

    missing = mint_token(PRIVATE_KEY, sub="user_abc")
    with pytest.raises(HTTPException) as exc:
        get_verified_user(FakeRequest(f"Bearer {missing}"))
    assert exc.value.status_code == 401

    forged = mint_token(PRIVATE_KEY, sub="user_abc", azp="https://evil.example.test")
    with pytest.raises(HTTPException) as exc:
        get_verified_user(FakeRequest(f"Bearer {forged}"))
    assert exc.value.status_code == 401

    accepted = mint_token(
        PRIVATE_KEY, sub="user_abc", azp="https://app.example.test"
    )
    assert get_verified_user(FakeRequest(f"Bearer {accepted}")) == "user_abc"
