"""Idempotent answer-run store semantics."""

import os
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils import idempotency


class Query:
    def __init__(self, rows):
        self.rows = rows
        self.selected = False

    def select(self, *_args):
        self.selected = True
        return self

    def eq(self, field, value):
        self.rows = [row for row in self.rows if str(row.get(field)) == str(value)]
        return self

    def limit(self, *_args):
        return self

    def insert(self, payload):
        self.rows.append(dict(payload))
        return self

    def update(self, payload):
        for row in self.rows:
            row.update(payload)
        return self

    def execute(self):
        return SimpleNamespace(data=[dict(row) for row in self.rows])


class Client:
    def __init__(self, rows=None, fail=False):
        self.rows = rows if rows is not None else []
        self.fail = fail

    def table(self, _name):
        if self.fail:
            raise RuntimeError("store down")
        return Query(self.rows)


def test_first_claim_starts_a_run():
    client = Client()
    claim = idempotency.claim_run(
        client, actor_id="user_1", idempotency_key="k1", fingerprint="fp"
    )
    assert claim.state == "new"
    assert client.rows[0]["status"] == "in_progress"


def test_same_key_and_body_replays_committed_response():
    client = Client()
    idempotency.claim_run(client, actor_id="user_1", idempotency_key="k1", fingerprint="fp")
    assert idempotency.complete_run(
        client, actor_id="user_1", idempotency_key="k1", response={"answer": "a"}
    )
    claim = idempotency.claim_run(
        client, actor_id="user_1", idempotency_key="k1", fingerprint="fp"
    )
    assert claim.state == "replay"
    assert claim.response == {"answer": "a"}


def test_same_key_with_changed_body_conflicts():
    client = Client()
    idempotency.claim_run(client, actor_id="user_1", idempotency_key="k1", fingerprint="fp")
    claim = idempotency.claim_run(
        client, actor_id="user_1", idempotency_key="k1", fingerprint="different"
    )
    assert claim.state == "conflict"


def test_in_flight_run_is_not_repeated():
    client = Client()
    idempotency.claim_run(client, actor_id="user_1", idempotency_key="k1", fingerprint="fp")
    claim = idempotency.claim_run(
        client, actor_id="user_1", idempotency_key="k1", fingerprint="fp"
    )
    assert claim.state == "in_progress"


def test_failed_run_may_retry_with_same_key():
    client = Client()
    idempotency.claim_run(client, actor_id="user_1", idempotency_key="k1", fingerprint="fp")
    idempotency.fail_run(client, actor_id="user_1", idempotency_key="k1")
    claim = idempotency.claim_run(
        client, actor_id="user_1", idempotency_key="k1", fingerprint="fp"
    )
    assert claim.state == "new"


def test_complete_requires_an_existing_run():
    assert (
        idempotency.complete_run(
            Client(), actor_id="user_1", idempotency_key="missing", response={"answer": "a"}
        )
        is False
    )


def test_store_outage_fails_closed():
    with pytest.raises(idempotency.IdempotencyUnavailable):
        idempotency.claim_run(
            Client(fail=True), actor_id="user_1", idempotency_key="k1", fingerprint="fp"
        )


def test_fingerprint_is_stable_and_order_independent():
    first = idempotency.request_fingerprint({"a": 1, "b": [2, 3]})
    second = idempotency.request_fingerprint({"b": [2, 3], "a": 1})
    assert first == second
    assert first != idempotency.request_fingerprint({"a": 2, "b": [2, 3]})
