"""Forwarded headers must not let a caller choose its own rate-limit key."""

import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import rate_limits


class FakeRequest:
    def __init__(self, peer: str, headers: dict[str, str]):
        self.client = SimpleNamespace(host=peer)
        self.headers = headers


def test_untrusted_peer_cannot_spoof_forwarded_for(monkeypatch):
    monkeypatch.delenv("TRUST_PROXY_HEADERS", raising=False)
    monkeypatch.delenv("TRUSTED_PROXY_IPS", raising=False)

    request = FakeRequest(
        "203.0.113.9", {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
    )

    assert rate_limits.get_proxy_aware_remote_address(request) == "203.0.113.9"


def test_trusted_proxy_uses_rightmost_forwarded_hop(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_IPS", "10.0.0.0/8")

    request = FakeRequest(
        "10.1.2.3", {"x-forwarded-for": "1.2.3.4, 203.0.113.9"}
    )

    assert rate_limits.get_proxy_aware_remote_address(request) == "203.0.113.9"


def test_explicit_trust_switch_allows_forwarded_headers(monkeypatch):
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "true")

    request = FakeRequest("198.51.100.7", {"x-real-ip": "203.0.113.10"})

    assert rate_limits.get_proxy_aware_remote_address(request) == "203.0.113.10"
