"""Authorization boundary tests: identity, ownership and permission denial."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

import pytest
from fastapi import HTTPException

from auth_helpers import install_fake_jwks, make_keypair, mint_token
from utils import authorization as authz
from utils.authorization import (
    ANONYMOUS,
    Actor,
    ActorKind,
    authorize_owner,
    get_actor,
    require_authenticated,
    require_machine_credential,
    require_permission,
)
from utils.auth import get_verified_user

PRIVATE_KEY, PUBLIC_KEY = make_keypair()


class FakeRequest:
    def __init__(self, auth_header=None):
        self.headers = {}
        if auth_header is not None:
            self.headers["authorization"] = auth_header


@pytest.mark.parametrize(
    "header",
    [
        "",
        " ",
        "Basic dXNlcjpwYXNz",
        "Bearer",
        "Bearer   ",
        "Token abc",
        "Bearer a b",
        "bearer\t",
    ],
)
def test_malformed_authorization_headers_are_401(header):
    with pytest.raises(HTTPException) as exc:
        get_verified_user(FakeRequest(header))
    assert exc.value.status_code == 401

    with pytest.raises(HTTPException) as actor_exc:
        get_actor(FakeRequest(header))
    assert actor_exc.value.status_code == 401


def test_missing_header_is_anonymous():
    assert get_verified_user(FakeRequest()) is None
    assert get_actor(FakeRequest()) is ANONYMOUS


def test_valid_token_produces_citizen_actor(monkeypatch):
    monkeypatch.setattr("utils.auth.verified_account_email", lambda subject: "citizen@example.com")
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    token = mint_token(PRIVATE_KEY, sub="user_abc")
    actor = get_actor(FakeRequest(f"Bearer {token}"))
    assert actor.kind is ActorKind.CITIZEN
    assert actor.subject == "user_abc"


def test_require_authenticated_rejects_anonymous():
    with pytest.raises(HTTPException) as exc:
        require_authenticated(ANONYMOUS)
    assert exc.value.status_code == 401


def test_owner_check_uses_verified_subject():
    actor = Actor(ActorKind.CITIZEN, "user_owner")
    assert authorize_owner(actor, "user_owner") == "user_owner"


@pytest.mark.parametrize("owner_id", ["user_other", "", "   ", None])
def test_owner_check_denies_other_or_missing_owner(owner_id):
    actor = Actor(ActorKind.CITIZEN, "user_owner")
    with pytest.raises(HTTPException) as exc:
        authorize_owner(actor, owner_id)
    assert exc.value.status_code == 403


def test_owner_check_requires_identity_first():
    with pytest.raises(HTTPException) as exc:
        authorize_owner(ANONYMOUS, "user_owner")
    assert exc.value.status_code == 401


def test_permission_check_fails_closed_when_provider_unavailable(monkeypatch):
    def unavailable(_actor):
        raise authz.RoleSourceUnavailable("no provider")

    monkeypatch.setattr(authz, "resolve_permissions", unavailable)
    dependency = require_permission(authz.DOCUMENTS_MANAGE)
    with pytest.raises(HTTPException) as exc:
        dependency(Actor(ActorKind.CITIZEN, "user_admin"))
    assert exc.value.status_code == 503


def test_configured_role_source_without_provider_still_fails_closed(monkeypatch):
    monkeypatch.setenv("TRUSTED_ROLE_SOURCE", "https://roles.example.com")

    def unavailable(_actor):
        raise authz.RoleSourceUnavailable("no provider")

    monkeypatch.setattr(authz, "resolve_permissions", unavailable)
    dependency = require_permission(authz.EVALUATION_READ)
    with pytest.raises(HTTPException) as exc:
        dependency(Actor(ActorKind.CITIZEN, "user_researcher"))
    assert exc.value.status_code == 503


def test_authentication_alone_is_not_admin(monkeypatch):
    # A resolved grant list that does not contain the operation is a 403, even
    # for a signed-in user. Admin is never inferred from authentication.
    monkeypatch.setattr(authz, "resolve_permissions", lambda actor: frozenset({"evaluation.read"}))
    dependency = require_permission(authz.DOCUMENTS_MANAGE)
    with pytest.raises(HTTPException) as exc:
        dependency(Actor(ActorKind.CITIZEN, "user_citizen"))
    assert exc.value.status_code == 403


def test_granted_permission_is_allowed(monkeypatch):
    monkeypatch.setattr(authz, "resolve_permissions", lambda actor: frozenset({"evaluation.read"}))
    dependency = require_permission(authz.EVALUATION_READ)
    actor = Actor(ActorKind.CITIZEN, "user_researcher")
    assert dependency(actor) is actor


def test_permission_check_rejects_anonymous(monkeypatch):
    monkeypatch.setattr(authz, "resolve_permissions", lambda actor: frozenset({"evaluation.read"}))
    dependency = require_permission(authz.EVALUATION_READ)
    with pytest.raises(HTTPException) as exc:
        dependency(ANONYMOUS)
    assert exc.value.status_code == 401


def test_machine_credential_missing_configuration_fails_closed(monkeypatch):
    monkeypatch.delenv("TEST_MACHINE_SECRET", raising=False)
    with pytest.raises(HTTPException) as exc:
        require_machine_credential("anything", "TEST_MACHINE_SECRET")
    assert exc.value.status_code == 503


def test_machine_credential_rejects_wrong_secret(monkeypatch):
    monkeypatch.setenv("TEST_MACHINE_SECRET", "correct-horse")
    with pytest.raises(HTTPException) as exc:
        require_machine_credential("wrong", "TEST_MACHINE_SECRET")
    assert exc.value.status_code == 401
    with pytest.raises(HTTPException) as empty:
        require_machine_credential("", "TEST_MACHINE_SECRET")
    assert empty.value.status_code == 401


def test_machine_credential_accepts_exact_secret(monkeypatch):
    monkeypatch.setenv("TEST_MACHINE_SECRET", "correct-horse")
    require_machine_credential("correct-horse", "TEST_MACHINE_SECRET")
