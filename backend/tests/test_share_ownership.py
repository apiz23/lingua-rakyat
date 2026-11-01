import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi import HTTPException

import utils.shared_answers as sa


class FakeQuery:
    def __init__(self, store, payload=None):
        self.store = store
        self.payload = payload
        self._filters = {}
        self._delete = False
        self._order = None

    def insert(self, payload):
        return FakeQuery(self.store, payload)

    def select(self, *_):
        return self

    def order(self, field, desc=False):
        self._order = (field, desc)
        return self

    def eq(self, field, value):
        self._filters[field] = value
        return self

    def delete(self):
        self._delete = True
        return self

    def execute(self):
        class Res:
            pass
        res = Res()
        if self.payload is not None:  # insert path
            if self.store.get("_reject_user_id_column") and "user_id" in self.payload:
                raise RuntimeError("column lr_shared_answers.user_id does not exist")
            self.store[self.payload["slug"]] = self.payload
            res.data = [self.payload]
            return res
        rows = [
            r for r in self.store.values()
            if isinstance(r, dict)
            and all(r.get(f) == v for f, v in self._filters.items())
        ]
        if self._delete:
            for r in rows:
                self.store.pop(r["slug"], None)
            res.data = rows
            return res
        if self._order:
            field, desc = self._order
            rows = sorted(rows, key=lambda r: r.get(field, ""), reverse=desc)
        res.data = rows
        return res


class FakeSupabase:
    def __init__(self):
        self.store = {}
        self.client_accesses = []

    def table(self, _name):
        return FakeQuery(self.store)


def _with_fake(monkeypatch):
    fake = FakeSupabase()
    def get_client(*, admin=False):
        fake.client_accesses.append(admin)
        return fake
    monkeypatch.setattr(sa, "get_supabase", get_client)
    return fake


def test_store_share_stamps_owner(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(
        question="Q", answer="A", sources=[], language="ms", user_id="user_abc"
    )
    assert fake.store[slug]["user_id"] == "user_abc"


def test_store_share_requires_verified_owner(monkeypatch):
    fake = _with_fake(monkeypatch)
    with pytest.raises(ValueError):
        sa.store_share(question="Q", answer="A", sources=[], language="ms", user_id="")
    assert fake.client_accesses == []


def test_store_share_does_not_retry_without_owner_when_column_missing(monkeypatch):
    fake = _with_fake(monkeypatch)
    fake.store["_reject_user_id_column"] = True
    with pytest.raises(RuntimeError, match="column lr_shared_answers.user_id does not exist"):
        sa.store_share(
            question="Q", answer="A", sources=[], language="ms", user_id="user_abc"
        )
    assert fake.client_accesses == [False]
    assert not any(isinstance(row, dict) and "slug" in row for row in fake.store.values())


def test_list_shares_for_user_only_owner_rows(monkeypatch):
    fake = _with_fake(monkeypatch)
    sa.store_share(question="mine", answer="A", sources=[], language="ms", user_id="user_abc")
    sa.store_share(question="theirs", answer="A", sources=[], language="ms", user_id="user_other")
    rows = sa.list_shares_for_user("user_abc")
    assert [r["question"] for r in rows] == ["mine"]


def test_delete_share_removes_row(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(question="Q", answer="A", sources=[], language="ms", user_id="user_abc")
    assert sa.delete_share(slug, user_id="user_abc") is True
    assert fake.client_accesses == [False, True]
    assert sa.get_share(slug) is None


def test_revoke_endpoint_owner_only(monkeypatch):
    fake = _with_fake(monkeypatch)
    from routers.share import revoke_share
    slug = sa.store_share(question="Q", answer="A", sources=[], language="ms", user_id="user_abc")

    with pytest.raises(HTTPException) as exc:
        revoke_share(slug, verified="user_other")
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        revoke_share("nope", verified="user_abc")
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        revoke_share(slug, verified=None)
    assert exc.value.status_code == 401
    assert True not in fake.client_accesses

    result = revoke_share(slug, verified="user_abc")
    assert result == {"success": True}
    assert fake.client_accesses[-1] is True


def test_revoke_anonymous_share_forbidden(monkeypatch):
    fake = _with_fake(monkeypatch)
    from routers.share import revoke_share
    slug = sa.store_share(question="Q", answer="A", sources=[], language="ms", user_id="user_abc")
    fake.store[slug].pop("user_id")  # legacy ownerless public share
    with pytest.raises(HTTPException) as exc:
        revoke_share(slug, verified="user_abc")
    assert exc.value.status_code == 403
    assert True not in fake.client_accesses


def test_mine_endpoint_requires_auth():
    from routers.share import my_shares
    with pytest.raises(HTTPException) as exc:
        my_shares(verified=None)
    assert exc.value.status_code == 401
