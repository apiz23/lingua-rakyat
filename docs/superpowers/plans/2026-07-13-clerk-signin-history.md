# Clerk Sign-In, Synced History & My Shares Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optional Clerk sign-in that syncs chat history across devices, adopts the device's anonymous history on first sign-in, and gives signed-in users a "My shares" list with revoke — while anonymous users keep working exactly as today.

**Architecture:** Frontend keeps calling FastAPI directly. `@clerk/nextjs` supplies sign-in UI and session tokens; a module-level token getter injects `Authorization: Bearer` into `apiFetch` and the SSE stream fetch. FastAPI gains one dependency (`get_verified_user`) that verifies Clerk JWTs against the JWKS endpoint (PyJWT); a valid token's `sub` overrides any client-supplied `user_id`. New endpoints: `POST /api/user/merge-anon`, `GET /api/share/mine`, `DELETE /api/share/{slug}`.

**Tech Stack:** FastAPI + PyJWT[crypto] + Supabase (backend), Next.js 16 + @clerk/nextjs (frontend), pytest.

**Spec:** `docs/superpowers/specs/2026-07-13-clerk-signin-history-design.md`

## Global Constraints

- Anonymous path byte-identical to today: no `Authorization` header → identity = client-supplied `user_id`; existing 79 tests must keep passing.
- Invalid/expired/malformed token → **401** (never silent fallback to anonymous). JWKS unreachable → **503**.
- When a valid token is present, its `sub` claim **overrides** any client-supplied `user_id` on: `/api/chat/ask`, `/api/chat/ask-stream`, `/api/chat/conversations`, `/api/chat/history`, `DELETE /api/chat/history/{document_id}`, `POST /api/share`.
- `lr_shared_answers.user_id` is nullable; `NULL` = anonymous/legacy share — never listed in `/mine`, never revocable.
- Route order: `GET /mine` MUST be declared before `GET /{slug}` in `backend/routers/share.py`, or "mine" is captured as a slug.
- Merge rejects `anon_user_id` values starting with `user_` (Clerk ID prefix) with 400.
- Env: backend `CLERK_ISSUER`; frontend `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`. Frontend tasks are BLOCKED until the Clerk keys exist in `frontend/.env.local` (user action).
- **Manual migration (user action, non-breaking if late — backend tolerates a missing column):** run in Supabase SQL editor:
  `alter table lr_shared_answers add column if not exists user_id text; create index if not exists idx_lr_shared_answers_user_id on lr_shared_answers(user_id);`
- Backend commands: from `backend/` with `.venv/Scripts/python.exe -m pytest`. Frontend: `pnpm` from `frontend/`. Repo has 46 pre-existing lint errors in untouched files — `pnpm build` success is the frontend gate.

---

### Task 1: Backend — Clerk JWT verification

**Files:**
- Create: `backend/utils/auth.py`
- Create: `backend/tests/auth_helpers.py` (shared test helper — NOT prefixed `test_`)
- Test: `backend/tests/test_auth_verify.py` (create)
- Modify: `backend/requirements.txt` (append deps)

**Interfaces:**
- Produces: `get_verified_user(request: Request) -> Optional[str]` — FastAPI dependency; returns Clerk `sub` for a valid Bearer token, `None` when no/blank Authorization header, raises `HTTPException(401)` on invalid token, `HTTPException(503)` when JWKS is unreachable. Tasks 2 and 3 depend on it. Also `verify_clerk_token(token: str) -> str` (internal, tested directly).
- Produces (test infra): `auth_helpers.make_keypair()`, `auth_helpers.mint_token(...)`, `auth_helpers.install_fake_jwks(monkeypatch, public_key)` — Tasks 2 and 3 reuse these.

- [ ] **Step 1: Add dependencies**

Append to `backend/requirements.txt`:

```
PyJWT>=2.8
cryptography>=42.0
```

Run (from `backend/`): `.venv/Scripts/python.exe -m pip install "PyJWT>=2.8" "cryptography>=42.0"`

- [ ] **Step 2: Write the shared test helper**

Create `backend/tests/auth_helpers.py`:

```python
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
```

- [ ] **Step 3: Write the failing tests**

Create `backend/tests/test_auth_verify.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

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
```

- [ ] **Step 4: Run tests to verify they fail**

Run (from `backend/`): `.venv/Scripts/python.exe -m pytest tests/test_auth_verify.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'utils.auth'`.

- [ ] **Step 5: Implement `backend/utils/auth.py`**

```python
"""
Clerk JWT verification for optional sign-in.

Identity model: a request with a valid `Authorization: Bearer <token>` header
resolves to the Clerk user id (`sub` claim). A request with no header resolves
to None — callers fall back to the client-supplied anonymous user_id, which is
today's behavior. An invalid token is a hard 401, never a silent fallback.
"""

import logging
import os
from typing import Optional

import jwt
from fastapi import HTTPException, Request

logger = logging.getLogger("auth")

CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")

_jwk_client: Optional[jwt.PyJWKClient] = None


def _get_jwk_client() -> jwt.PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        if not CLERK_ISSUER:
            raise RuntimeError("CLERK_ISSUER must be set to verify sign-in tokens.")
        _jwk_client = jwt.PyJWKClient(
            f"{CLERK_ISSUER}/.well-known/jwks.json", cache_keys=True
        )
    return _jwk_client


def verify_clerk_token(token: str) -> str:
    """Return the Clerk user id (sub). Raises jwt exceptions when invalid."""
    signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=CLERK_ISSUER,
        # Clerk session tokens carry `azp`, not `aud`.
        options={"verify_aud": False},
    )
    sub = claims.get("sub", "")
    if not sub:
        raise jwt.InvalidTokenError("Token has no sub claim")
    return sub


def get_verified_user(request: Request) -> Optional[str]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:].strip()
    if not token:
        return None
    try:
        return verify_clerk_token(token)
    except jwt.exceptions.PyJWKClientConnectionError as exc:
        logger.error("[Auth] JWKS unreachable: %s", exc)
        raise HTTPException(status_code=503, detail="Sign-in verification unavailable") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
    except RuntimeError as exc:
        logger.error("[Auth] Misconfiguration: %s", exc)
        raise HTTPException(status_code=503, detail="Sign-in verification unavailable") from exc
```

Note: `_get_jwk_client` is looked up at call time inside `get_verified_user`/`verify_clerk_token` via module attribute, so tests can monkeypatch it. Do NOT bind it to a local variable at import time.

- [ ] **Step 6: Run tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_auth_verify.py -v`
Expected: 7 PASS.

- [ ] **Step 7: Run full backend suite**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: 86 passed (79 existing + 7 new).

- [ ] **Step 8: Commit**

```bash
git add backend/utils/auth.py backend/tests/auth_helpers.py backend/tests/test_auth_verify.py backend/requirements.txt
git commit -m "feat(auth): verify Clerk session tokens against JWKS"
```

---

### Task 2: Backend — identity override on chat routes + merge endpoint

**Files:**
- Modify: `backend/routers/chat.py` (handlers at lines ~160, ~205, ~263, ~270, ~299)
- Create: `backend/routers/user.py`
- Modify: `backend/main.py` (router import ~line 59, mount ~line 160)
- Test: `backend/tests/test_identity_and_merge.py` (create)

**Interfaces:**
- Consumes: `get_verified_user` from Task 1; `auth_helpers` test utilities.
- Produces: `POST /api/user/merge-anon` accepting `{"anon_user_id": str}` returning `{"chat_rows": int, "share_rows": int}`; all chat routes honoring token-derived identity. Task 5's frontend calls `merge-anon`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_identity_and_merge.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi import HTTPException

from auth_helpers import install_fake_jwks, make_keypair, mint_token

PRIVATE_KEY, PUBLIC_KEY = make_keypair()


class FakeRequest:
    def __init__(self, auth_header=None):
        self.headers = {}
        if auth_header is not None:
            self.headers["authorization"] = auth_header


# ── FakeSupabase with update support (extends the pattern in test_share_fields.py) ──

class FakeQuery:
    def __init__(self, store, table):
        self.store = store
        self.table_name = table
        self._update_payload = None
        self._eq = None

    def update(self, payload):
        self._update_payload = payload
        return self

    def eq(self, field, value):
        self._eq = (field, value)
        return self

    def execute(self):
        class Res:
            pass
        res = Res()
        field, value = self._eq
        updated = []
        for row in self.store.get(self.table_name, []):
            if row.get(field) == value:
                row.update(self._update_payload)
                updated.append(row)
        res.data = updated
        return res


class FakeSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return FakeQuery(self.store, name)


def _verified(monkeypatch, sub="user_abc"):
    install_fake_jwks(monkeypatch, PUBLIC_KEY)
    token = mint_token(PRIVATE_KEY, sub=sub)
    from utils.auth import get_verified_user
    return get_verified_user(FakeRequest(f"Bearer {token}"))


def test_merge_moves_rows_in_both_tables(monkeypatch):
    from routers import user as user_router
    store = {
        "lr_chat_messages": [
            {"user_id": "anon-1", "question": "q1"},
            {"user_id": "anon-1", "question": "q2"},
            {"user_id": "other", "question": "q3"},
        ],
        "lr_shared_answers": [{"user_id": "anon-1", "slug": "s1"}],
    }
    monkeypatch.setattr(user_router, "get_supabase", lambda: FakeSupabase(store))
    body = user_router.MergeRequest(anon_user_id="anon-1")
    resp = user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert resp.chat_rows == 2
    assert resp.share_rows == 1
    assert store["lr_chat_messages"][0]["user_id"] == "user_abc"
    assert store["lr_chat_messages"][2]["user_id"] == "other"


def test_merge_is_idempotent(monkeypatch):
    from routers import user as user_router
    store = {"lr_chat_messages": [], "lr_shared_answers": []}
    monkeypatch.setattr(user_router, "get_supabase", lambda: FakeSupabase(store))
    body = user_router.MergeRequest(anon_user_id="anon-gone")
    resp = user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert resp.chat_rows == 0
    assert resp.share_rows == 0


def test_merge_requires_auth():
    from routers import user as user_router
    body = user_router.MergeRequest(anon_user_id="anon-1")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=None)
    assert exc.value.status_code == 401


def test_merge_rejects_clerk_id_as_anon(monkeypatch):
    from routers import user as user_router
    body = user_router.MergeRequest(anon_user_id="user_victim")
    with pytest.raises(HTTPException) as exc:
        user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert exc.value.status_code == 400


def test_merge_tolerates_missing_share_column(monkeypatch):
    from routers import user as user_router

    class ExplodingShareSupabase(FakeSupabase):
        def table(self, name):
            if name == "lr_shared_answers":
                raise RuntimeError("column lr_shared_answers.user_id does not exist")
            return super().table(name)

    store = {"lr_chat_messages": [{"user_id": "anon-1"}]}
    monkeypatch.setattr(user_router, "get_supabase", lambda: ExplodingShareSupabase(store))
    body = user_router.MergeRequest(anon_user_id="anon-1")
    resp = user_router.merge_anon(body, verified=_verified(monkeypatch))
    assert resp.chat_rows == 1
    assert resp.share_rows == 0


def test_conversations_token_overrides_query_user(monkeypatch):
    import routers.chat as chat
    captured = {}
    def fake_list(uid):
        captured["uid"] = uid
        return []

    monkeypatch.setattr(chat, "list_conversations", fake_list)
    import asyncio
    asyncio.run(chat.get_conversations(user_id="spoofed-id", verified="user_abc"))
    assert captured["uid"] == "user_abc"


def test_history_payload_uses_verified_user():
    from routers.chat import AskRequest, _history_payload
    body = AskRequest(
        user_id="user_abc",  # handler has already overridden this from the token
        document_id="d1",
        document_name="Doc",
        session_id="s1",
        question="q",
    )
    payload = _history_payload(body, {}, "2026-01-01T00:00:00Z", "a")
    assert payload["user_id"] == "user_abc"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_identity_and_merge.py -v`
Expected: mostly FAIL — `No module named 'routers.user'` and `get_conversations() got an unexpected keyword argument 'verified'`. (`test_history_payload_uses_verified_user` already passes — it is a regression guard documenting that the payload carries whatever the handler set.)

- [ ] **Step 3: Create `backend/routers/user.py`**

```python
"""routers/user.py — account actions: merge anonymous history into a signed-in account."""
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.auth import get_verified_user
from utils.shared_answers import get_supabase

logger = logging.getLogger("user_router")
router = APIRouter()

CHAT_TABLE = os.getenv("CHAT_HISTORY_TABLE", "lr_chat_messages")
SHARE_TABLE = "lr_shared_answers"


class MergeRequest(BaseModel):
    anon_user_id: str = Field(min_length=1)


class MergeResponse(BaseModel):
    chat_rows: int
    share_rows: int


@router.post("/merge-anon", response_model=MergeResponse)
def merge_anon(body: MergeRequest, verified: Optional[str] = Depends(get_verified_user)):
    if not verified:
        raise HTTPException(status_code=401, detail="Sign-in required")
    anon = body.anon_user_id.strip()
    if not anon or anon.startswith("user_"):
        raise HTTPException(status_code=400, detail="anon_user_id must be an anonymous ID")

    client = get_supabase()
    res = client.table(CHAT_TABLE).update({"user_id": verified}).eq("user_id", anon).execute()
    chat_rows = len(res.data or [])

    share_rows = 0
    try:
        res = client.table(SHARE_TABLE).update({"user_id": verified}).eq("user_id", anon).execute()
        share_rows = len(res.data or [])
    except Exception as exc:
        # Pre-migration tolerance: lr_shared_answers.user_id may not exist yet.
        logger.warning("[Merge] share-table update skipped: %s", exc)

    logger.info("[Merge] %s adopted %d chat rows, %d shares from %s", verified, chat_rows, share_rows, anon)
    return MergeResponse(chat_rows=chat_rows, share_rows=share_rows)
```

- [ ] **Step 4: Mount the router in `backend/main.py`**

After line 59 (`from routers.share import router as share_router`):

```python
from routers.user import router as user_router
```

After line 160 (`app.include_router(share_router, ...)`):

```python
app.include_router(user_router,      prefix="/api/user",      tags=["User"])
```

- [ ] **Step 5: Apply identity override in `backend/routers/chat.py`**

Add imports (top of file, alongside existing fastapi import):

```python
from fastapi import APIRouter, Depends, HTTPException, Request
from utils.auth import get_verified_user
```

`ask_question` (line ~162) — new signature and first line of body:

```python
async def ask_question(
    request: Request,
    body: AskRequest,
    verified: Optional[str] = Depends(get_verified_user),
):
    _ = request
    if verified:
        body.user_id = verified
    _validate_ask_request(body)
```

`ask_question_stream` (line ~207) — same pattern:

```python
async def ask_question_stream(
    request: Request,
    body: AskRequest,
    verified: Optional[str] = Depends(get_verified_user),
):
    _ = request
    if verified:
        body.user_id = verified
    _validate_ask_request(body)
```

`get_conversations` (line ~264):

```python
async def get_conversations(
    user_id: str = "",
    verified: Optional[str] = Depends(get_verified_user),
):
    if verified:
        user_id = verified
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")
    return list_conversations(user_id)
```

`get_chat_history` (line ~271) — add the parameter and override before the `list_chat_messages` call:

```python
async def get_chat_history(
    document_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    verified: Optional[str] = Depends(get_verified_user),
):
    if verified:
        user_id = verified
    rows = list_chat_messages(document_id=document_id, session_id=session_id, user_id=user_id)
```

(rest of the function unchanged)

`clear_document_chat_history` (line ~300):

```python
async def clear_document_chat_history(
    document_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    verified: Optional[str] = Depends(get_verified_user),
):
    if verified:
        user_id = verified
    deleted = clear_chat_history(document_id, user_id=user_id, session_id=session_id)
```

(rest unchanged)

- [ ] **Step 6: Run tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_identity_and_merge.py -v`
Expected: 7 PASS.

- [ ] **Step 7: Run full backend suite**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: 93 passed (86 + 7). The existing tests must pass unchanged — the anonymous path (no header → `verified=None`) leaves every handler's behavior identical.

- [ ] **Step 8: Commit**

```bash
git add backend/routers/chat.py backend/routers/user.py backend/main.py backend/tests/test_identity_and_merge.py
git commit -m "feat(auth): token identity on chat routes and anonymous-history merge"
```

---

### Task 3: Backend — share ownership, /mine, revoke

**Files:**
- Modify: `backend/utils/shared_answers.py` (docstring SQL, `store_share`, new `list_shares_for_user` + `delete_share`)
- Modify: `backend/routers/share.py` (owner stamping, `GET /mine` BEFORE `GET /{slug}`, `DELETE /{slug}`)
- Test: `backend/tests/test_share_ownership.py` (create)

**Interfaces:**
- Consumes: `get_verified_user` (Task 1), `auth_helpers`.
- Produces: `store_share(..., user_id: Optional[str] = None)`; `list_shares_for_user(user_id) -> list[dict]`; `delete_share(slug) -> bool`; `GET /api/share/mine` → `[{slug, question, confidence_label, agency, created_at}]`; `DELETE /api/share/{slug}` → `{"success": true}`. Task 6's frontend consumes both endpoints.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_share_ownership.py`:

```python
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

    def table(self, _name):
        return FakeQuery(self.store)


def _with_fake(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(sa, "get_supabase", lambda: fake)
    return fake


def test_store_share_stamps_owner(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(
        question="Q", answer="A", sources=[], language="ms", user_id="user_abc"
    )
    assert fake.store[slug]["user_id"] == "user_abc"


def test_store_share_anonymous_has_no_owner_key(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(question="Q", answer="A", sources=[], language="ms")
    assert "user_id" not in fake.store[slug]


def test_store_share_retries_without_user_id_pre_migration(monkeypatch):
    fake = _with_fake(monkeypatch)
    fake.store["_reject_user_id_column"] = True
    slug = sa.store_share(
        question="Q", answer="A", sources=[], language="ms", user_id="user_abc"
    )
    assert "user_id" not in fake.store[slug]  # stored, minus the unknown column


def test_list_shares_for_user_only_owner_rows(monkeypatch):
    fake = _with_fake(monkeypatch)
    sa.store_share(question="mine", answer="A", sources=[], language="ms", user_id="user_abc")
    sa.store_share(question="theirs", answer="A", sources=[], language="ms", user_id="user_other")
    sa.store_share(question="anon", answer="A", sources=[], language="ms")
    rows = sa.list_shares_for_user("user_abc")
    assert [r["question"] for r in rows] == ["mine"]


def test_delete_share_removes_row(monkeypatch):
    fake = _with_fake(monkeypatch)
    slug = sa.store_share(question="Q", answer="A", sources=[], language="ms", user_id="user_abc")
    assert sa.delete_share(slug) is True
    assert sa.get_share(slug) is None


def test_revoke_endpoint_owner_only(monkeypatch):
    _with_fake(monkeypatch)
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

    result = revoke_share(slug, verified="user_abc")
    assert result == {"success": True}


def test_revoke_anonymous_share_forbidden(monkeypatch):
    _with_fake(monkeypatch)
    from routers.share import revoke_share
    slug = sa.store_share(question="Q", answer="A", sources=[], language="ms")
    with pytest.raises(HTTPException) as exc:
        revoke_share(slug, verified="user_abc")
    assert exc.value.status_code == 403


def test_mine_endpoint_requires_auth():
    from routers.share import my_shares
    with pytest.raises(HTTPException) as exc:
        my_shares(verified=None)
    assert exc.value.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_share_ownership.py -v`
Expected: FAIL — `store_share() got an unexpected keyword argument 'user_id'`, missing `list_shares_for_user`, `revoke_share`, `my_shares`.

- [ ] **Step 3: Extend `backend/utils/shared_answers.py`**

Append to the docstring's SQL block:

```
Migration for share ownership (run once in Supabase SQL editor):

alter table lr_shared_answers add column if not exists user_id text;
create index if not exists idx_lr_shared_answers_user_id
  on lr_shared_answers(user_id);
```

Replace `store_share` (keep everything else in the function identical) — new signature plus conditional owner key plus pre-migration retry:

```python
def store_share(
    question: str,
    answer: str,
    sources: list[dict],
    language: str,
    confidence: float = 0.0,
    confidence_label: str = "",
    agency: str = "",
    user_id: Optional[str] = None,
) -> str:
    slug = secrets.token_urlsafe(12)  # 72-bit entropy — negligible collision risk
    payload = {
        "slug": slug,
        "question": question,
        "answer": answer,
        "sources": sources,
        "language": language,
        "confidence": confidence,
        "confidence_label": confidence_label,
        "agency": agency,
    }
    if user_id:
        payload["user_id"] = user_id
    try:
        res = get_supabase().table(TABLE).insert(payload).execute()
    except Exception as exc:
        if "user_id" not in payload:
            raise
        # Pre-migration tolerance: retry without the ownership column.
        logger.warning("[Share] Insert with user_id failed (%s); retrying without owner", exc)
        payload.pop("user_id")
        res = get_supabase().table(TABLE).insert(payload).execute()
    if not res.data:
        raise RuntimeError(f"[Share] Insert returned no data for slug={slug}")
    logger.info("[Share] Stored slug=%s", slug)
    return slug
```

Append after `get_share`:

```python
def list_shares_for_user(user_id: str) -> list[dict[str, Any]]:
    try:
        res = (
            get_supabase()
            .table(TABLE)
            .select("slug, question, confidence_label, agency, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        logger.warning("[Share] list_shares_for_user failed for %s: %s", user_id, exc)
        return []


def delete_share(slug: str) -> bool:
    res = get_supabase().table(TABLE).delete().eq("slug", slug).execute()
    return bool(res.data)
```

- [ ] **Step 4: Extend `backend/routers/share.py`**

New imports:

```python
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from utils.auth import get_verified_user
from utils.shared_answers import delete_share, get_share, list_shares_for_user, store_share
```

In `create_share`, add the dependency and pass the owner through:

```python
@router.post("", response_model=ShareResponse)
async def create_share(body: ShareRequest, verified: Optional[str] = Depends(get_verified_user)):
    if not body.question.strip() or not body.answer.strip():
        raise HTTPException(status_code=400, detail="question and answer are required")
    try:
        slug = store_share(
            question=body.question,
            answer=body.answer,
            sources=body.sources,
            language=body.language,
            confidence=body.confidence,
            confidence_label=body.confidence_label,
            agency=body.agency,
            user_id=verified,
        )
    except Exception as exc:
        logger.error("[Share] Failed to store: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create share link") from exc
    return ShareResponse(slug=slug, url=f"/share/{slug}")
```

Add — **placed ABOVE the existing `GET /{slug}` route, or "mine" will be captured as a slug**:

```python
class MyShareItem(BaseModel):
    slug: str
    question: str
    confidence_label: str = ""
    agency: str = ""
    created_at: str = ""


@router.get("/mine", response_model=list[MyShareItem])
def my_shares(verified: Optional[str] = Depends(get_verified_user)):
    if not verified:
        raise HTTPException(status_code=401, detail="Sign-in required")
    rows = list_shares_for_user(verified)
    return [
        MyShareItem(
            slug=row["slug"],
            question=row.get("question", ""),
            confidence_label=row.get("confidence_label", "") or "",
            agency=row.get("agency", "") or "",
            created_at=row.get("created_at", "") or "",
        )
        for row in rows
    ]
```

Add after the `GET /{slug}` route:

```python
@router.delete("/{slug}")
def revoke_share(slug: str, verified: Optional[str] = Depends(get_verified_user)):
    if not verified:
        raise HTTPException(status_code=401, detail="Sign-in required")
    row = get_share(slug)
    if row is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    if not row.get("user_id") or row["user_id"] != verified:
        # Anonymous/legacy shares have no owner and can never be revoked.
        raise HTTPException(status_code=403, detail="Not your share")
    delete_share(slug)
    logger.info("[Share] %s revoked slug=%s", verified, slug)
    return {"success": True}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_share_ownership.py -v`
Expected: 8 PASS.

- [ ] **Step 6: Run full backend suite**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: 101 passed (93 + 8).

- [ ] **Step 7: Commit**

```bash
git add backend/utils/shared_answers.py backend/routers/share.py backend/tests/test_share_ownership.py
git commit -m "feat(share): owner stamping, my-shares list, and revoke"
```

---

### Task 4: Frontend — Clerk foundation and token plumbing

**PRECONDITION:** `frontend/.env.local` must contain `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (user creates the Clerk app). Check first: `grep CLERK frontend/.env.local`. If absent, report BLOCKED — `pnpm build` fails without them once `ClerkProvider` wraps the app.

**Files:**
- Modify: `frontend/package.json` (via `pnpm add @clerk/nextjs`)
- Create: `frontend/middleware.ts`
- Create: `frontend/lib/auth-token.ts`
- Create: `frontend/components/auth-sync.tsx`
- Modify: `frontend/app/layout.tsx` (ClerkProvider + AuthSync)
- Modify: `frontend/lib/api.ts` (`apiFetch` ~line 187, stream fetch ~line 589, new `mergeAnonHistory`)

**Interfaces:**
- Consumes: `POST /api/user/merge-anon` (Task 2).
- Produces: `setAuthTokenGetter(fn)` + `authHeader()` in `lib/auth-token.ts`; `mergeAnonHistory(anonUserId: string): Promise<boolean>` in `lib/api.ts`; `<AuthSync />` mounted globally. Tasks 5–6 rely on signed-in `apiFetch` carrying the token automatically.

- [ ] **Step 1: Install Clerk**

Run (from `frontend/`): `pnpm add @clerk/nextjs`

- [ ] **Step 2: Create `frontend/middleware.ts`**

```ts
import { clerkMiddleware } from "@clerk/nextjs/server"

// No route protection — sign-in is optional everywhere. The middleware only
// lets Clerk resolve sessions for server-side rendering.
export default clerkMiddleware()

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
}
```

(`/__clerk/:path*` must follow `/(api|trpc)(.*)` — required by Clerk's Next.js proxy for the middleware to resolve sessions correctly.)

- [ ] **Step 3: Create `frontend/lib/auth-token.ts`**

```ts
// Bridge between Clerk's React-context getToken() and plain fetch helpers.
type TokenGetter = () => Promise<string | null>

let tokenGetter: TokenGetter | null = null

export function setAuthTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn
}

export async function authHeader(): Promise<Record<string, string>> {
  if (!tokenGetter) return {}
  try {
    const token = await tokenGetter()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {} // never let auth plumbing break an anonymous request
  }
}
```

- [ ] **Step 4: Create `frontend/components/auth-sync.tsx`**

```tsx
"use client"

import { useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { setAuthTokenGetter } from "@/lib/auth-token"
import { mergeAnonHistory } from "@/lib/api"

// Registers the Clerk token getter for API calls, adopts anonymous history
// into the account on first sign-in, and mints a fresh anonymous ID after
// sign-out.
export default function AuthSync() {
  const { getToken, isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null)
    return () => setAuthTokenGetter(null)
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) {
      const anon = localStorage.getItem("lr-user-id")
      if (anon && !anon.startsWith("user_")) {
        mergeAnonHistory(anon).then((ok) => {
          if (ok) localStorage.removeItem("lr-user-id")
        })
      }
    } else if (!localStorage.getItem("lr-user-id")) {
      // Signed out: device starts a clean anonymous identity.
      localStorage.setItem("lr-user-id", crypto.randomUUID())
    }
  }, [isLoaded, isSignedIn])

  return null
}
```

- [ ] **Step 5: Wire provider into `frontend/app/layout.tsx`**

Add imports:

```tsx
import { ClerkProvider } from "@clerk/nextjs"
import AuthSync from "@/components/auth-sync"
```

**Critical:** `ClerkProvider` must go INSIDE `<body>`, not wrapping `<html>` (Clerk CLI rule — wrapping `<html>` breaks hydration). Keep `<html>` untouched and wrap the `<body>` contents instead, mounting AuthSync next to OfflineProvider:

```tsx
  return (
    <html
      lang="en"
      ...  // existing attributes unchanged
    >
      <body className="min-h-screen bg-background text-foreground">
        <ClerkProvider afterSignOutUrl="/workspace">
          ...  // existing ThemeProvider/LanguageProvider/TooltipProvider nesting unchanged
                <Toaster richColors expand={true} position="top-center" />
                {children}
                <AuthSync />
                <OfflineProvider />
                <CommandPaletteTopRight />
          ...
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  )
```

(`afterSignOutUrl` forces a navigation on sign-out so `workspace/page.tsx` remounts and picks up the fresh anonymous ID.)

- [ ] **Step 6: Token on `apiFetch` (`frontend/lib/api.ts` ~line 187)**

Add import at the top of the file:

```ts
import { authHeader } from "@/lib/auth-token"
```

Replace `apiFetch`:

```ts
// ── Rate-limit aware fetch ─────────────────────────────────────────────────
async function apiFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const auth = await authHeader()
  const withAuth = (extra: Record<string, string>): RequestInit => ({
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), ...extra },
  })
  let res = await fetch(input, withAuth(auth))
  if (res.status === 401 && auth.Authorization) {
    // Clerk session tokens are short-lived; retry once with a fresh token.
    res = await fetch(input, withAuth(await authHeader()))
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") ?? "60"
    throw new Error(
      `Too many requests — please wait ${retryAfter} seconds and try again.`
    )
  }
  return res
}
```

(All existing call sites pass plain-object headers, so the spread is safe.)

- [ ] **Step 7: Token on the SSE stream fetch (~line 589)**

In `askQuestionStream`, change the fetch headers line:

```ts
    res = await fetch(`${API_URL}/api/chat/ask-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
```

(everything else in the call unchanged)

- [ ] **Step 8: Add `mergeAnonHistory` to `frontend/lib/api.ts`** (near `listConversations`, ~line 820)

```ts
export async function mergeAnonHistory(anonUserId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_URL}/api/user/merge-anon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anon_user_id: anonUserId }),
    })
    return res.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 9: Build**

Run (from `frontend/`): `pnpm build`
Expected: success. If it fails with a missing publishable key, the env precondition was not met — report BLOCKED.

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/middleware.ts frontend/lib/auth-token.ts frontend/components/auth-sync.tsx frontend/app/layout.tsx frontend/lib/api.ts
git commit -m "feat(auth): Clerk provider, token plumbing, and anon-history merge trigger"
```

---

### Task 5: Frontend — identity switch + sidebar auth controls

**Files:**
- Create: `frontend/components/auth-controls.tsx`
- Modify: `frontend/app/(app)/workspace/page.tsx` (userId derivation, lines 16-24)
- Modify: `frontend/components/chat-panel/conversation-sidebar.tsx` (footer after `</ScrollArea>`, line ~157)

**Interfaces:**
- Consumes: Clerk hooks/components from Task 4's provider.
- Produces: `<AuthControls />` (used in the sidebar; `/shares` link target built in Task 6 — the link may 404 until Task 6 lands, acceptable within the same branch).

- [ ] **Step 1: Create `frontend/components/auth-controls.tsx`**

```tsx
"use client"

import Link from "next/link"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// Sidebar footer: sign-in for anonymous users, account menu + My shares link
// for signed-in users. Sign-in is optional — this never gates anything.
export function AuthControls() {
  return (
    <div className="border-t border-sidebar-border p-3">
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="outline" size="sm" className="w-full">
            Sign in to sync history
          </Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center justify-between gap-2">
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link
                label="My shares"
                href="/shares"
                labelIcon={<Share2 className="h-4 w-4" />}
              />
            </UserButton.MenuItems>
          </UserButton>
          <Link
            href="/shares"
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            My shares
          </Link>
        </div>
      </SignedIn>
    </div>
  )
}
```

- [ ] **Step 2: Mount it in the sidebar**

In `frontend/components/chat-panel/conversation-sidebar.tsx`, add the import:

```tsx
import { AuthControls } from "@/components/auth-controls"
```

Insert between `</ScrollArea>` and `</aside>` (line ~157):

```tsx
      </ScrollArea>

      <AuthControls />
    </aside>
```

- [ ] **Step 3: Identity switch in `frontend/app/(app)/workspace/page.tsx`**

Add import:

```tsx
import { useUser } from "@clerk/nextjs"
```

Replace the `userId` state block (lines 16-24) with:

```tsx
  const { user } = useUser()
  const [anonId] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    let id = localStorage.getItem("lr-user-id")
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem("lr-user-id", id)
    }
    return id
  })
  // Signed in → Clerk identity (backend verifies the token anyway);
  // signed out → the device's anonymous ID, exactly as before.
  const userId = user?.id ?? anonId
```

Note: the initializer may mint an anonymous ID even while signed in (Clerk loads after mount); AuthSync's merge then adopts-and-clears it — harmless, zero rows.

`userId` is already passed to `ConversationSidebar` and `ChatPanel` — no further changes; both re-fetch when the prop flips from anon to Clerk ID.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/auth-controls.tsx frontend/components/chat-panel/conversation-sidebar.tsx "frontend/app/(app)/workspace/page.tsx"
git commit -m "feat(auth): sidebar sign-in controls and Clerk identity for history"
```

---

### Task 6: Frontend — My shares page

**Files:**
- Modify: `frontend/lib/api.ts` (add `MyShare`, `listMyShares`, `revokeShare` near `createShare` ~line 851)
- Create: `frontend/app/(app)/shares/page.tsx`

**Interfaces:**
- Consumes: `GET /api/share/mine`, `DELETE /api/share/{slug}` (Task 3); `apiFetch` token injection (Task 4).
- Produces: `/shares` route (the target of Task 5's links).

- [ ] **Step 1: API functions in `frontend/lib/api.ts`**

```ts
export interface MyShare {
  slug: string
  question: string
  confidence_label: string
  agency: string
  created_at: string
}

export async function listMyShares(): Promise<MyShare[]> {
  try {
    const res = await apiFetch(`${API_URL}/api/share/mine`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function revokeShare(slug: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_URL}/api/share/${slug}`, {
      method: "DELETE",
    })
    return res.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Create `frontend/app/(app)/shares/page.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs"
import { Copy, Share2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listMyShares, revokeShare, type MyShare } from "@/lib/api"

const CHIP_STYLES: Record<string, string> = {
  high: "bg-primary/10 text-primary",
  medium: "bg-muted text-muted-foreground",
  low: "bg-warning/15 text-warning",
}

export default function MySharesPage() {
  const { isSignedIn } = useUser()
  const [shares, setShares] = useState<MyShare[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    setLoading(true)
    listMyShares()
      .then(setShares)
      .finally(() => setLoading(false))
  }, [isSignedIn])

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${slug}`)
    toast.success("Link copied")
  }

  const onRevoke = async (slug: string) => {
    const ok = await revokeShare(slug)
    if (ok) {
      setShares((prev) => prev.filter((s) => s.slug !== slug))
      toast.success("Share revoked — the public link no longer works")
    } else {
      toast.error("Could not revoke this share")
    }
    setConfirmSlug(null)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold">My shares</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Answers you have shared publicly. Revoking a share makes its link stop
        working.
      </p>

      <SignedOut>
        <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center">
          <Share2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to see and manage the answers you have shared.
          </p>
          <SignInButton mode="modal">
            <Button className="mt-4" size="sm">
              Sign in
            </Button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="mt-6 flex flex-col gap-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 bg-muted/40" />
            ))
          ) : shares.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No shares yet — use the share button on any answer.
            </p>
          ) : (
            shares.map((share) => (
              <div
                key={share.slug}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/share/${share.slug}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
                  >
                    {share.question}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyLink(share.slug)}
                      aria-label="Copy link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmSlug(share.slug)}
                      aria-label="Revoke share"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {share.confidence_label && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${CHIP_STYLES[share.confidence_label] ?? CHIP_STYLES.medium}`}
                    >
                      {share.confidence_label}
                    </span>
                  )}
                  {share.agency && <span>{share.agency}</span>}
                  {share.created_at && (
                    <span>{new Date(share.created_at).toLocaleDateString()}</span>
                  )}
                </div>
                {confirmSlug === share.slug && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs">
                    <span className="flex-1">
                      Revoke this share? The public link stops working.
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onRevoke(share.slug)}
                    >
                      Revoke
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmSlug(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SignedIn>
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: success, `/shares` in the route list.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts "frontend/app/(app)/shares/page.tsx"
git commit -m "feat(share): my-shares page with copy and revoke"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full backend suite**

Run (from `backend/`): `.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: 101 passed.

- [ ] **Step 2: Frontend build**

Run (from `frontend/`): `pnpm build`
Expected: success.

- [ ] **Step 3: Local smoke test (needs Clerk keys + CLERK_ISSUER + backend running)**

Start backend (`backend/.venv/Scripts/python.exe -m uvicorn main:app --port 8000` with `CLERK_ISSUER` set) and `pnpm dev`. Verify:
- Signed out: ask a question — works exactly as before; conversation appears in the sidebar.
- Sign in (sidebar button): the anonymous conversation appears under the account (merge); localStorage `lr-user-id` is gone.
- Ask another question signed in; open a second browser/incognito, sign in — same history appears.
- Share an answer while signed in → `/shares` lists it → revoke → the public `/share/[slug]` 404s.
- Sign out → sidebar shows sign-in button; fresh `lr-user-id` exists; history is empty (clean device).
Skip any step blocked by missing env/migration; note skips in the final report.

- [ ] **Step 4: Reminders for the final report**

- Manual Supabase migration (Global Constraints) — non-breaking if late, but `/mine`, revoke, owner stamping, and share-merge silently no-op until it runs.
- Deploy env: `CLERK_ISSUER` on the backend host; both Clerk keys on Vercel. Add the production domain to the Clerk app's allowed origins.
- Post-deploy: repeat the cross-device check on lingua-rakyat.my.
