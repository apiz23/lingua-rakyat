"""Expiry selection and the server-side sweeper."""

import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.expiry import find_expired_documents, parse_timestamp, run_expiry

NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)


class Query:
    def __init__(self, tables, name):
        self.tables = tables
        self.name = name
        self.rows = list(tables.get(name, []))
        self.pending_update = None

    def select(self, *_args):
        return self

    def eq(self, field, value):
        self.rows = [row for row in self.rows if str(row.get(field)) == str(value)]
        return self

    def limit(self, *_args):
        return self

    def update(self, payload):
        self.pending_update = payload
        return self

    def insert(self, payload):
        self.tables.setdefault(self.name, []).append(dict(payload))
        return self

    def execute(self):
        if self.pending_update is not None:
            for row in self.rows:
                row.update(self.pending_update)
            return SimpleNamespace(data=list(self.rows))
        return SimpleNamespace(data=list(self.rows))


class Client:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return Query(self.tables, name)


def test_parse_timestamp_rejects_naive_and_malformed():
    assert parse_timestamp("2026-11-03T00:00:00Z") is not None
    assert parse_timestamp("2026-11-03T00:00:00") is None
    assert parse_timestamp("not-a-date") is None
    assert parse_timestamp(None) is None


def test_only_published_documents_past_expiry_are_due():
    rows = [
        {"id": "a", "publication_status": "published", "expires_at": (NOW - timedelta(seconds=1)).isoformat()},
        {"id": "b", "publication_status": "published", "expires_at": (NOW + timedelta(days=1)).isoformat()},
        {"id": "c", "publication_status": "draft", "expires_at": (NOW - timedelta(days=1)).isoformat()},
        {"id": "d", "publication_status": "published", "expires_at": "bad"},
        {"id": "e", "publication_status": "published", "expires_at": None},
    ]
    due = [row["id"] for row in find_expired_documents(rows, now=NOW)]
    assert due == ["a"]


def test_run_expiry_records_each_event_once_on_retry():
    row = {
        "id": "doc-1",
        "publication_status": "published",
        "expires_at": (NOW - timedelta(minutes=5)).isoformat(),
        "current_revision": 1,
    }
    client = Client({"lr_documents": [row], "publication_events": []})

    first = run_expiry(client, now=NOW)
    second = run_expiry(client, now=NOW)

    assert first == {"due": 1, "expired": 1}
    assert second == {"due": 0, "expired": 0}
    assert client.tables["lr_documents"][0]["publication_status"] == "expired"
    assert len(client.tables["publication_events"]) == 1
