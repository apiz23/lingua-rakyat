"""Shared helpers for minting Clerk-like test JWTs against a fake JWKS."""
import datetime

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

TEST_ISSUER = "https://test-issuer.clerk.accounts.dev"
TEST_KID = "test-key-1"


def make_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


def mint_token(
    private_key,
    sub: str = "user_test123",
    issuer: str = TEST_ISSUER,
    expires_in: int = 300,
    kid: str = TEST_KID,
) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": sub,
        "iss": issuer,
        "iat": now,
        "exp": now + datetime.timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": kid})


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


class _FakeJWKClient:
    def __init__(self, public_key):
        self._public_key = public_key

    def get_signing_key_from_jwt(self, _token):
        return _FakeSigningKey(self._public_key)


def install_fake_jwks(monkeypatch, public_key):
    """Point utils.auth at a fake JWKS client + the test issuer."""
    import utils.auth as auth

    monkeypatch.setattr(auth, "CLERK_ISSUER", TEST_ISSUER)
    monkeypatch.setattr(auth, "_get_jwk_client", lambda: _FakeJWKClient(public_key))
