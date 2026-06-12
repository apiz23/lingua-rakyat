# Conversation-First Chat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the workspace from document-first to conversation-first (Claude/ChatGPT/Gemini shell), adding a conversations sidebar, library section, empty-state chips, share links, confidence sentences, and language/text-size controls — while keeping all existing RAG/streaming/voice flows intact.

**Architecture:** Backend adds a `GET /api/chat/conversations` grouping endpoint (no schema migration — groups existing `lr_chat_messages` rows by `session_id` in Python) and a new `routers/share.py` with a `lr_shared_answers` Supabase table. Frontend refactors `workspace/page.tsx` into a three-region shell (`ConversationSidebar` | `ChatPanel` | nothing) and extracts focused sub-components (`EmptyState`, `Composer`) from the monolithic `chat-panel/index.tsx`. The multi-doc-default change (askAllDocs default ON + auto-anchor) already exists uncommitted and will be committed in Task 1.

**Tech Stack:** FastAPI, Supabase (Python client), Next.js 14, Tailwind CSS, shadcn/ui, TypeScript, pytest

---

## File Map

### Backend — new / modified
- **Create:** `backend/routers/share.py` — `POST /api/share`, `GET /api/share/{slug}`
- **Create:** `backend/utils/shared_answers.py` — `store_share`, `get_share` (Supabase `lr_shared_answers`)
- **Create:** `backend/tests/test_conversations.py` — grouping + ordering unit tests
- **Create:** `backend/tests/test_share.py` — share round-trip + 404 tests
- **Modify:** `backend/utils/chat_history.py` — add `list_conversations(user_id)`
- **Modify:** `backend/routers/chat.py` — add `GET /conversations` endpoint
- **Modify:** `backend/main.py` — register share router

### Frontend — new / modified
- **Create:** `frontend/components/chat-panel/conversation-sidebar.tsx` — rail: new-chat, conversation list, documents section
- **Create:** `frontend/components/chat-panel/empty-state.tsx` — greeting + tappable example chips
- **Create:** `frontend/components/chat-panel/composer.tsx` — input, attach, mic, send/stop
- **Modify:** `frontend/components/chat-panel/index.tsx` — slim to orchestrator; add `sessionId` prop; remove doc-picker + composer code; wire new sub-components
- **Modify:** `frontend/app/(app)/workspace/page.tsx` — three-region shell; own `activeSessionId`; remove doc-picker dropdown
- **Modify:** `frontend/lib/api.ts` — add `listConversations`, `createShare`, `getShare`
- **Modify:** `frontend/components/language-provider.tsx` — add `zh-cn` to `AppLanguage`
- **Modify:** `frontend/components/chat-panel/message-cards.tsx` — collapsed sources, confidence sentence, share button
- **Create:** `frontend/app/share/[slug]/page.tsx` — public read-only share page (outside `(app)` group — no AppShell nav chrome)

---

## Phase 1 — Backend: conversations + commit uncommitted work

### Task 1: Commit the multi-doc-default changes

**Files:**
- Modify: `frontend/app/(app)/workspace/page.tsx` (already edited — auto-anchor on first ready doc)
- Modify: `frontend/components/chat-panel/index.tsx` (already edited — `askAllDocs` default `true`)

- [ ] **Step 1: Verify the two uncommitted edits are present**

```bash
git diff --stat
```
Expected: two files changed — `workspace/page.tsx` and `chat-panel/index.tsx`.

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(app\)/workspace/page.tsx frontend/components/chat-panel/index.tsx
git commit -m "feat(chat): default to multi-doc + auto-anchor first ready doc

Auto-picks the first ready document as session anchor so citizens
land in a working chat without choosing a file. askAllDocs now
defaults ON so every question searches the whole ready library.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: `list_conversations` backend helper

**Files:**
- Modify: `backend/utils/chat_history.py`
- Create: `backend/tests/test_conversations.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_conversations.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch
import utils.chat_history as ch

_ROWS = [
    {"session_id": "s1", "question": "Passport fee?",    "created_at": "2026-06-12T10:00:00Z"},
    {"session_id": "s2", "question": "KWSP question",    "created_at": "2026-06-12T09:00:00Z"},
    {"session_id": "s1", "question": "First question s1","created_at": "2026-06-12T08:00:00Z"},
]

def test_groups_by_session():
    with patch.object(ch, "list_chat_messages", return_value=_ROWS):
        convs = ch.list_conversations("user1")
    assert len(convs) == 2

def test_title_is_earliest_question():
    with patch.object(ch, "list_chat_messages", return_value=_ROWS):
        convs = ch.list_conversations("user1")
    s1 = next(c for c in convs if c["session_id"] == "s1")
    assert s1["title"] == "First question s1"

def test_ordered_by_last_at_desc():
    with patch.object(ch, "list_chat_messages", return_value=_ROWS):
        convs = ch.list_conversations("user1")
    assert convs[0]["session_id"] == "s1"  # last_at 10:00 > 09:00

def test_count_is_correct():
    with patch.object(ch, "list_chat_messages", return_value=_ROWS):
        convs = ch.list_conversations("user1")
    s1 = next(c for c in convs if c["session_id"] == "s1")
    assert s1["count"] == 2

def test_empty_user_returns_empty():
    with patch.object(ch, "list_chat_messages", return_value=[]):
        convs = ch.list_conversations("nobody")
    assert convs == []
```

- [ ] **Step 2: Run — expect FAIL (AttributeError: module has no attribute 'list_conversations')**

```bash
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_conversations.py -q
```

- [ ] **Step 3: Implement `list_conversations` in `backend/utils/chat_history.py`**

Add after the existing imports at the top of the file (no new imports needed):

```python
def list_conversations(user_id: str) -> list[dict]:
    """Group lr_chat_messages by session_id for the sidebar conversation list.

    Rows come back newest-first from list_chat_messages, so iterating and
    always overwriting `title` with the current row's question yields the
    oldest (first) question as the title when the loop finishes.
    """
    rows = list_chat_messages(user_id=user_id)
    sessions: dict[str, dict] = {}
    for row in rows:
        sid = row.get("session_id", "")
        if not sid:
            continue
        q = (row.get("question") or "")[:80]
        ts = row.get("created_at", "")
        if sid not in sessions:
            sessions[sid] = {"session_id": sid, "title": q, "last_at": ts, "count": 0}
        sessions[sid]["count"] += 1
        sessions[sid]["title"] = q  # overwrite → last write = oldest row = first question
    return sorted(sessions.values(), key=lambda x: x["last_at"], reverse=True)
```

- [ ] **Step 4: Run — expect 5 PASS**

```bash
./venv/Scripts/python.exe -m pytest tests/test_conversations.py -q
```

- [ ] **Step 5: Commit**

```bash
git add backend/utils/chat_history.py backend/tests/test_conversations.py
git commit -m "feat(chat): list_conversations groups session history for sidebar

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: `GET /api/chat/conversations` endpoint

**Files:**
- Modify: `backend/routers/chat.py`

- [ ] **Step 1: Add the endpoint** — in `backend/routers/chat.py`, after the existing imports add `list_conversations` to the import from `utils.chat_history`:

```python
from utils.chat_history import (
    delete_chat_messages,
    delete_chat_messages_for_document,
    insert_chat_message,
    list_chat_messages,
    list_conversations,
)
```

Then add the endpoint before the `@router.get("/history")` route:

```python
class ConversationSummary(BaseModel):
    session_id: str
    title: str
    last_at: str
    count: int


@router.get("/conversations", response_model=list[ConversationSummary])
async def get_conversations(user_id: str):
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")
    return list_conversations(user_id)
```

- [ ] **Step 2: Manual smoke test** (backend must be running)

```bash
curl "http://localhost:8000/api/chat/conversations?user_id=test" | python -m json.tool
```
Expected: `[]` or a list of `{session_id, title, last_at, count}` objects.

- [ ] **Step 3: Commit**

```bash
git add backend/routers/chat.py
git commit -m "feat(chat): GET /api/chat/conversations endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 2 — Backend: share link

### Task 4: `shared_answers` Supabase util + table

**Files:**
- Create: `backend/utils/shared_answers.py`
- Create: `backend/tests/test_share.py`

- [ ] **Step 1: Create the Supabase table** — run this SQL in the Supabase SQL editor:

```sql
create table lr_shared_answers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  question text not null,
  answer text not null,
  sources jsonb not null default '[]',
  language text not null default 'ms',
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_share.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
import utils.shared_answers as sa

_PAYLOAD = {
    "question": "Berapa yuran pasport?",
    "answer": "RM200 untuk 5 tahun.",
    "sources": [{"text": "...","document_id": "doc1","score": 0.9,"doc_name":"JPN"}],
    "language": "ms",
}

def _mock_supabase(stored: dict | None = None):
    mock = MagicMock()
    insert_chain = mock.table.return_value.insert.return_value.execute
    insert_chain.return_value.data = [{"slug": "abc12345"}]
    select_chain = mock.table.return_value.select.return_value.eq.return_value.execute
    select_chain.return_value.data = [stored] if stored else []
    return mock

def test_store_returns_slug():
    with patch.object(sa, "get_supabase", return_value=_mock_supabase()):
        slug = sa.store_share(**_PAYLOAD)
    assert isinstance(slug, str) and len(slug) > 0

def test_get_returns_payload():
    stored = {**_PAYLOAD, "slug": "abc12345", "id": "uuid", "created_at": "2026-06-12T00:00:00Z"}
    with patch.object(sa, "get_supabase", return_value=_mock_supabase(stored)):
        result = sa.get_share("abc12345")
    assert result is not None
    assert result["question"] == _PAYLOAD["question"]

def test_get_returns_none_for_missing():
    with patch.object(sa, "get_supabase", return_value=_mock_supabase(None)):
        result = sa.get_share("notfound")
    assert result is None
```

- [ ] **Step 3: Run — expect FAIL (no module)**

```bash
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_share.py -q
```

- [ ] **Step 4: Create `backend/utils/shared_answers.py`**

```python
import logging
import os
import secrets
from typing import Any, Optional

from supabase import Client, create_client

logger = logging.getLogger("shared_answers")
TABLE = "lr_shared_answers"

_supabase: Optional[Client] = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set.")
        _supabase = create_client(url, key)
    return _supabase


def store_share(
    question: str,
    answer: str,
    sources: list[dict],
    language: str,
) -> str:
    slug = secrets.token_urlsafe(8)
    payload = {
        "slug": slug,
        "question": question,
        "answer": answer,
        "sources": sources,
        "language": language,
    }
    get_supabase().table(TABLE).insert(payload).execute()
    logger.info("[Share] Stored slug=%s", slug)
    return slug


def get_share(slug: str) -> Optional[dict[str, Any]]:
    try:
        res = get_supabase().table(TABLE).select("*").eq("slug", slug).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("[Share] get_share failed for slug=%s: %s", slug, exc)
        return None
```

- [ ] **Step 5: Run — expect 3 PASS**

```bash
./venv/Scripts/python.exe -m pytest tests/test_share.py -q
```

- [ ] **Step 6: Commit**

```bash
git add backend/utils/shared_answers.py backend/tests/test_share.py
git commit -m "feat(share): shared_answers Supabase util + tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: `share` router + register

**Files:**
- Create: `backend/routers/share.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create `backend/routers/share.py`**

```python
"""routers/share.py — create and retrieve shared answer links."""
import logging
from typing import Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from utils.shared_answers import get_share, store_share

logger = logging.getLogger("share_router")
router = APIRouter()


class ShareRequest(BaseModel):
    question: str
    answer: str
    sources: list[dict] = []
    language: str = "ms"


class ShareResponse(BaseModel):
    slug: str
    url: str


class SharedAnswerResponse(BaseModel):
    slug: str
    question: str
    answer: str
    sources: list[dict]
    language: str
    created_at: str


@router.post("", response_model=ShareResponse)
async def create_share(body: ShareRequest, request: Any = None):
    if not body.question.strip() or not body.answer.strip():
        raise HTTPException(status_code=400, detail="question and answer are required")
    try:
        slug = store_share(
            question=body.question,
            answer=body.answer,
            sources=body.sources,
            language=body.language,
        )
    except Exception as exc:
        logger.error("[Share] Failed to store: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create share link") from exc
    return ShareResponse(slug=slug, url=f"/share/{slug}")


@router.get("/{slug}", response_model=SharedAnswerResponse)
async def fetch_share(slug: str):
    result = get_share(slug)
    if result is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    return SharedAnswerResponse(
        slug=result["slug"],
        question=result["question"],
        answer=result["answer"],
        sources=result.get("sources", []),
        language=result.get("language", "ms"),
        created_at=result.get("created_at", ""),
    )
```

- [ ] **Step 2: Register in `backend/main.py`**

Add after the existing router imports (around line 58):

```python
from routers.share import router as share_router
```

Add after the existing `app.include_router` lines (around line 158):

```python
app.include_router(share_router,     prefix="/api/share",     tags=["Share"])
```

- [ ] **Step 3: Smoke test** (backend running)

```bash
curl -s -X POST http://localhost:8000/api/share \
  -H "Content-Type: application/json" \
  -d '{"question":"Test?","answer":"Test answer.","language":"ms"}' | python -m json.tool
```
Expected: `{"slug": "...", "url": "/share/..."}`.

```bash
# Replace <slug> with the slug from above
curl -s http://localhost:8000/api/share/<slug> | python -m json.tool
```
Expected: full answer payload.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/share.py backend/main.py
git commit -m "feat(share): POST /api/share + GET /api/share/{slug} endpoints

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 3 — Frontend: API layer additions

### Task 6: Add `listConversations`, `createShare`, `getShare` to `frontend/lib/api.ts`

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add types and functions** — open `frontend/lib/api.ts`, add at the end of the file:

```typescript
// ─── Conversations ───────────────────────────────────────────────────────────

export interface ConversationSummary {
  session_id: string
  title: string
  last_at: string
  count: number
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/chat/conversations?user_id=${encodeURIComponent(userId)}`
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// ─── Share links ─────────────────────────────────────────────────────────────

export interface ShareResult {
  slug: string
  url: string
}

export interface SharedAnswer {
  slug: string
  question: string
  answer: string
  sources: SourceChunk[]
  language: string
  created_at: string
}

export async function createShare(payload: {
  question: string
  answer: string
  sources: SourceChunk[]
  language: string
}): Promise<ShareResult | null> {
  try {
    const res = await fetch(`${API_URL}/api/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function getShare(slug: string): Promise<SharedAnswer | null> {
  try {
    const res = await fetch(`${API_URL}/api/share/${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(api): listConversations, createShare, getShare frontend helpers

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 4 — Frontend shell: conversation sidebar

### Task 7: `ConversationSidebar` component

**Files:**
- Create: `frontend/components/chat-panel/conversation-sidebar.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useEffect, useState } from "react"
import { ConversationSummary, Document, listConversations } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MessageSquare,
  Plus,
  FileText,
  Upload,
  CheckCircle,
  Loader2,
  Clock,
  CircleAlert,
} from "lucide-react"

interface ConversationSidebarProps {
  userId: string
  activeSessionId: string | null
  documents: Document[]
  docsLoading: boolean
  onNewChat: () => void
  onSelectConversation: (sessionId: string) => void
  onUpload: () => void
  className?: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function docStatusIcon(status: Document["status"]) {
  switch (status) {
    case "ready": return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
    case "processing": return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500" />
    case "error": return <CircleAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />
    default: return <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  }
}

export function ConversationSidebar({
  userId,
  activeSessionId,
  documents,
  docsLoading,
  onNewChat,
  onSelectConversation,
  onUpload,
  className,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [convsLoading, setConvsLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    setConvsLoading(true)
    listConversations(userId)
      .then(setConversations)
      .finally(() => setConvsLoading(false))
  }, [userId, activeSessionId])

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-border bg-card",
        className
      )}
    >
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        {/* Conversations */}
        <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent chats
        </div>

        {convsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mx-1 my-1 h-8 bg-muted/40" />
          ))
        ) : conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No chats yet — start one above
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.session_id}
              onClick={() => onSelectConversation(conv.session_id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left text-sm hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeSessionId === conv.session_id && "bg-primary/8 font-medium"
              )}
            >
              <span className="flex items-center gap-1.5 truncate">
                <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{conv.title}</span>
              </span>
              <span className="pl-4 text-[10px] text-muted-foreground">
                {relativeTime(conv.last_at)} · {conv.count} msg
              </span>
            </button>
          ))
        )}

        {/* Documents */}
        <div className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Your documents
        </div>

        {docsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="mx-1 my-1 h-8 bg-muted/40" />
          ))
        ) : documents.length === 0 ? (
          <p className="px-2 pb-2 text-center text-xs text-muted-foreground">
            No documents yet
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
            >
              {docStatusIcon(doc.status)}
              <span className="truncate text-foreground">{doc.name}</span>
            </div>
          ))
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onUpload}
          className="mt-1 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload PDF
        </Button>
      </ScrollArea>
    </aside>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/chat-panel/conversation-sidebar.tsx
git commit -m "feat(ui): ConversationSidebar component

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Restructure `workspace/page.tsx` into three-region shell

**Files:**
- Modify: `frontend/app/(app)/workspace/page.tsx`

Read the full current file before editing (it's ~365 lines). The goal: remove the doc-picker `<Popover>` from `composerTop`; add `<ConversationSidebar>` as a left rail sibling to `<ChatPanel>`; own `activeSessionId` state here.

- [ ] **Step 1: Read the current file**

```bash
cat frontend/app/\(app\)/workspace/page.tsx
```

- [ ] **Step 2: Add sidebar state and imports** — add to the import block at the top:

```typescript
import { ConversationSidebar } from "@/components/chat-panel/conversation-sidebar"
import { useMemo, useState } from "react"  // already imported, verify
```

Add state in the component body (after existing `useState` declarations):

```typescript
const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
const [userId] = useState<string>(() => {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem("lr-user-id")
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("lr-user-id", id) }
  return id
})
```

- [ ] **Step 3: Replace the return JSX** — replace the existing `return (...)` with:

```tsx
return (
  <div className="flex h-full w-full overflow-hidden bg-background">
    <ConversationSidebar
      userId={userId}
      activeSessionId={activeSessionId}
      documents={sortedDocs}
      docsLoading={docsLoading}
      onNewChat={() => {
        setActiveSessionId(null)
        setInitialQuestion(undefined)
      }}
      onSelectConversation={(sid) => setActiveSessionId(sid)}
      onUpload={() => setIsUploadOpen(true)}
      className="hidden sm:flex"
    />

    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <ChatPanel
        selectedDoc={selectedDoc}
        sessionId={activeSessionId}
        userId={userId}
        initialQuestion={initialQuestion}
        composerTop={null}
      />
    </div>

    <UploadModal
      isOpen={isUploadOpen}
      onClose={() => setIsUploadOpen(false)}
      onUploadComplete={async () => {
        const docs = await loadDocuments()
        const latest = docs?.sort((a, b) =>
          a.uploaded_at < b.uploaded_at ? 1 : -1
        )[0]
        if (latest) {
          setSelectedDoc(latest)
          setInitialQuestion("Summarize this document")
        }
      }}
    />
  </div>
)
```

- [ ] **Step 4: Update `ChatPanelProps` in `chat-panel/index.tsx`** — add two new props:

```typescript
interface ChatPanelProps {
  selectedDoc: Document | null
  sessionId?: string | null        // ← new: externally controlled session
  userId?: string                  // ← new: passed from workspace
  onBack?: () => void
  composerTop?: React.ReactNode
  emptyState?: React.ReactNode
  initialQuestion?: string
}
```

In the `ChatPanel` function signature, accept them:

```typescript
export default function ChatPanel({
  selectedDoc,
  sessionId: externalSessionId,
  userId: externalUserId,
  ...
```

Replace the local `userId` initialisation and the session-id effect to prefer external values when provided.

Find the `userId` state (grep for `lr-user-id` or `setUserId`) and change it to seed from the prop:

```typescript
const [userId, setUserId] = useState(externalUserId ?? "")
```

Find the `useEffect` that sets `sessionId` from `selectedDoc` (grep for `lr-chat-session-id`). Wrap the existing body in an `if` that skips it when an external session is provided:

```typescript
useEffect(() => {
  if (externalSessionId !== undefined) {
    setSessionId(externalSessionId ?? "")
    return
  }
  // ← existing doc-keyed session logic unchanged below here
}, [selectedDoc, externalSessionId])
```

Add `externalSessionId` to the dependency array.

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npx tsc --noEmit && echo OK
```

Fix any type errors before continuing.

- [ ] **Step 6: Manual check** — run dev server, open workspace. Left rail with "New chat" + conversations list + documents section should appear. Chat still works.

```bash
cd frontend && npm run dev
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(app\)/workspace/page.tsx frontend/components/chat-panel/index.tsx
git commit -m "feat(ui): three-region workspace shell with ConversationSidebar

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 5 — Frontend: empty state + chips

### Task 9: `EmptyState` component

**Files:**
- Create: `frontend/components/chat-panel/empty-state.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useLanguage } from "@/components/language-provider"

interface EmptyStateProps {
  onChipClick: (question: string) => void
}

const CHIPS: Record<string, string[]> = {
  ms: [
    "Berapa yuran tukar pasport?",
    "Cara reset kata laluan i-Akaun KWSP",
    "Apakah pelepasan cukai untuk ibu bapa?",
    "Dokumen perlu untuk renew MyKad",
    "Bila tarikh akhir e-Filing LHDN?",
  ],
  en: [
    "How much does passport renewal cost?",
    "How to reset KWSP i-Akaun password?",
    "What tax relief applies to parents?",
    "Documents needed to renew MyKad",
    "What is the LHDN e-Filing deadline?",
  ],
  zh: [
    "护照续期费用是多少？",
    "如何重置公积金 i-Akaun 密码？",
    "父母相关的税务减免有哪些？",
    "更新身份证需要哪些文件？",
    "LHDN 报税截止日期是什么时候？",
  ],
}

const GREETING: Record<string, { title: string; sub: string }> = {
  ms: { title: "Selamat datang", sub: "Tanya tentang dokumen kerajaan anda" },
  en: { title: "Welcome", sub: "Ask about your government documents" },
  zh: { title: "欢迎使用", sub: "查询您的政府文件" },
}

export function EmptyState({ onChipClick }: EmptyStateProps) {
  const { language } = useLanguage()
  const lang = language === "zh" ? "zh" : language
  const chips = CHIPS[lang] ?? CHIPS.ms
  const greeting = GREETING[lang] ?? GREETING.ms

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="mb-1 font-display text-3xl font-bold tracking-tight text-foreground">
        {greeting.title}
      </h1>
      <p className="mb-8 text-muted-foreground">{greeting.sub}</p>

      <div className="flex max-w-lg flex-wrap justify-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm transition hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `chat-panel/index.tsx`** — import and replace the existing empty state JSX.

Find where `!selectedDoc` renders the "no document" empty state (around line 1067 in the original). Replace with:

```tsx
import { EmptyState } from "./empty-state"

// In JSX, where messages.length === 0 and not loading:
{messages.length === 0 && !historyLoading && (
  <EmptyState onChipClick={(q) => {
    setInput(q)
    // submit immediately
    submitQuestion(q)
  }} />
)}
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit && echo OK
```

- [ ] **Step 4: Manual check** — new chat → empty state shows greeting + 5 chips in current language. Click a chip → question submits.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/chat-panel/empty-state.tsx frontend/components/chat-panel/index.tsx
git commit -m "feat(ui): EmptyState with example-question chips

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 6 — Frontend: answer card touches

### Task 10: Collapsed sources restyle in `message-cards.tsx`

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`

- [ ] **Step 1: Locate the sources toggle state**

```bash
grep -n "sourcesOpen\|showSources\|useState.*true\|ChevronDown\|ChevronUp" frontend/components/chat-panel/message-cards.tsx | head -20
```

Note the exact variable name and line numbers.

- [ ] **Step 2: Change the default to collapsed** — find the `useState` controlling the sources open/closed state and change its initial value to `false`:

```tsx
// Find something like:
const [sourcesOpen, setSourcesOpen] = useState(true)
// Change to:
const [sourcesOpen, setSourcesOpen] = useState(false)
```

- [ ] **Step 3: Add a one-line summary when collapsed** — in the collapsed trigger, show the first source's doc name + page:

```tsx
<button
  onClick={() => setSourcesOpen(!sourcesOpen)}
  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
>
  <FileText className="h-3 w-3" />
  {sourcesOpen ? "Hide sources" : (
    sources.length > 0
      ? `Source: ${sources[0].doc_name || sources[0].document_id}${sources[0].page_start ? ` · p.${sources[0].page_start}` : ""}${sources.length > 1 ? ` +${sources.length - 1} more` : ""}`
      : "Sources"
  )}
  {sourcesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
</button>
```

- [ ] **Step 4: Typecheck + manual check**

```bash
cd frontend && npx tsc --noEmit && echo OK
```
Check: answer card shows collapsed "Source: JPN Pasport · p.3" line. Click → expands full list.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/chat-panel/message-cards.tsx
git commit -m "feat(ui): collapsed sources default in answer card

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Confidence sentence in answer card

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`

The `Message` interface already has `confidence_label` and `sufficient_evidence`. Add a visible sentence when either is "low" or evidence insufficient.

- [ ] **Step 1: Add the confidence sentence helper** — in `message-cards.tsx`, add before the component:

```tsx
const CONFIDENCE_MSG: Record<string, Record<string, string>> = {
  ms: {
    low: "Padanan lemah — sila sahkan maklumat ini di sumber rasmi.",
    insufficient: "Tiada maklumat yang mencukupi dalam dokumen — sila rujuk sumber rasmi.",
  },
  en: {
    low: "Weak match — please verify this information with the official source.",
    insufficient: "Insufficient information found in the documents — please consult the official source.",
  },
  zh: {
    low: "匹配度较低 — 请向官方来源核实此信息。",
    insufficient: "文件中未找到足够信息 — 请参阅官方来源。",
  },
}

function confidenceSentence(msg: Message): string | null {
  const lang = msg.language?.startsWith("zh") ? "zh" : msg.language?.startsWith("ms") ? "ms" : "en"
  const map = CONFIDENCE_MSG[lang] ?? CONFIDENCE_MSG.en
  if (!msg.sufficient_evidence) return map.insufficient
  if (msg.confidence_label === "low") return map.low
  return null
}
```

- [ ] **Step 2: Render the sentence in the answer card** — find where the answer text is rendered in the `AIMessageCard` component. Add below the answer text and above the sources/toolbar:

```tsx
{(() => {
  const sentence = confidenceSentence(message)
  return sentence ? (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <span className="mt-0.5 shrink-0">⚠</span>
      <span>{sentence}</span>
    </div>
  ) : null
})()}
```

- [ ] **Step 3: Typecheck + manual check**

```bash
cd frontend && npx tsc --noEmit && echo OK
```
Ask a question where the answer has low confidence → amber box appears. High confidence → no box.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/chat-panel/message-cards.tsx
git commit -m "feat(ui): confidence sentence on low/insufficient evidence answers

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Share button on answer card

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`

- [ ] **Step 1: Add import** at the top of `message-cards.tsx`:

```typescript
import { Share2 } from "lucide-react"
import { createShare } from "@/lib/api"
import { toast } from "sonner"
```

- [ ] **Step 2: Add share handler in `AIMessageCard`** — inside the component, add:

```tsx
const [sharing, setSharing] = useState(false)

async function handleShare() {
  setSharing(true)
  try {
    const result = await createShare({
      question: message.question,
      answer: message.answer,
      sources: message.sources,
      language: message.language,
    })
    if (!result) { toast.error("Couldn't create link — try again"); return }
    const url = `${window.location.origin}${result.url}`
    await navigator.clipboard.writeText(url)
    toast.success("Link copied! Share via WhatsApp or SMS.")
  } finally {
    setSharing(false)
  }
}
```

- [ ] **Step 3: Add share button to the toolbar** — in the answer card toolbar (where copy / thumbs up / thumbs down live), add:

```tsx
<button
  onClick={handleShare}
  disabled={sharing}
  aria-label="Share answer"
  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
>
  <Share2 className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">{sharing ? "…" : "Share"}</span>
</button>
```

- [ ] **Step 4: Typecheck + manual check**

```bash
cd frontend && npx tsc --noEmit && echo OK
```
Click Share on an answer → clipboard gets URL, toast appears.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/chat-panel/message-cards.tsx
git commit -m "feat(ui): share button on answer card — creates /share/<slug> link

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Public `/share/[slug]` page

**Files:**
- Create: `frontend/app/(app)/share/[slug]/page.tsx`

- [ ] **Step 1: Create `frontend/app/share/[slug]/page.tsx`** (note: outside `(app)` group — no nav chrome)

```tsx
import { getShare } from "@/lib/api"
import { ChatMarkdown } from "@/components/chat-panel/chat-markdown"
import { notFound } from "next/navigation"

export default async function SharePage({ params }: { params: { slug: string } }) {
  const data = await getShare(params.slug)
  if (!data) notFound()

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Lingua Rakyat · Shared answer
      </div>

      <div className="mb-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
        <span className="font-medium">Q: </span>{data.question}
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ChatMarkdown content={data.answer} />
      </div>

      {data.sources.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Sources</div>
          {data.sources.map((s, i) => (
            <div key={i} className="mb-1 text-xs text-muted-foreground">
              📄 {s.doc_name || s.document_id}{s.page_start ? ` · p.${s.page_start}` : ""}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-xs text-muted-foreground">
        This answer was generated by{" "}
        <a href="/" className="text-primary underline">Lingua Rakyat</a>.
        Always verify with official government sources.
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + manual check**

```bash
cd frontend && npx tsc --noEmit && echo OK
```
Navigate to `http://localhost:3000/share/<slug>` (use a slug from Task 5 smoke test) → page renders.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/share/[slug]/page.tsx"
git commit -m "feat(ui): public /share/[slug] read-only answer page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 7 — Language + text-size

### Task 14: Add Chinese (`zh`) to the language provider

**Files:**
- Modify: `frontend/components/language-provider.tsx`

- [ ] **Step 1: Extend the type and logic**

```typescript
// Change:
type AppLanguage = "ms" | "en"
// To:
type AppLanguage = "ms" | "en" | "zh"

// Change the localStorage read guard:
if (saved === "ms" || saved === "en" || saved === "zh") {
  setLanguageState(saved)
}

// Change toggleLanguage:
toggleLanguage: () =>
  setLanguageState((prev) => prev === "ms" ? "en" : prev === "en" ? "zh" : "ms"),

// Change document.documentElement.lang:
document.documentElement.lang = language === "ms" ? "ms" : language === "zh" ? "zh" : "en"
```

- [ ] **Step 2: Update the language toggle button** — find wherever `toggleLanguage` is called in the UI (likely in `chat-panel/index.tsx` — search for `toggleLanguage`). Update the label to cycle MS → EN → 中文:

```tsx
// Before: shows "EN" or "BM"
// After: cycle through all three with display labels:
const langLabel = language === "ms" ? "BM" : language === "en" ? "EN" : "中文"
// The button already calls toggleLanguage() — just update the displayed label
```

- [ ] **Step 3: Update `EmptyState` chips** — `EmptyState` already references `language === "zh"` — no changes needed (written in Task 9 with zh support).

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit && echo OK
```

- [ ] **Step 5: Manual check** — toggle language in header: BM → EN → 中文 → BM. Empty state chips change language. Greeting changes.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/language-provider.tsx frontend/components/chat-panel/index.tsx
git commit -m "feat(i18n): add Chinese (zh) as third language option

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 15: `A⁺` text-size toggle

**Files:**
- Modify: `frontend/app/globals.css` (or equivalent global CSS)
- Modify: `frontend/components/chat-panel/index.tsx` (add toggle button)

- [ ] **Step 1: Add text-size CSS classes** — in `frontend/app/globals.css`, add:

```css
html[data-text-size="large"] {
  font-size: 112.5%; /* 18px base */
}
```

- [ ] **Step 2: Add toggle state + effect in `chat-panel/index.tsx`**

```typescript
const [largeText, setLargeText] = useState<boolean>(() => {
  if (typeof window === "undefined") return false
  return localStorage.getItem("lr-text-size") === "large"
})

useEffect(() => {
  document.documentElement.setAttribute(
    "data-text-size",
    largeText ? "large" : "normal"
  )
  localStorage.setItem("lr-text-size", largeText ? "large" : "normal")
}, [largeText])
```

- [ ] **Step 3: Add the A⁺ button** — in the chat panel header/toolbar area (near the existing language toggle), add:

```tsx
<button
  onClick={() => setLargeText((p) => !p)}
  aria-label={largeText ? "Switch to normal text size" : "Switch to large text size"}
  aria-pressed={largeText}
  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
>
  {largeText ? "A" : "A⁺"}
</button>
```

- [ ] **Step 4: Typecheck + manual check**

```bash
cd frontend && npx tsc --noEmit && echo OK
```
Click A⁺ → all text grows. Click again → normal. Refresh → preference persisted.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/globals.css frontend/components/chat-panel/index.tsx
git commit -m "feat(a11y): A+ text-size toggle persisted to localStorage

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 8 — Full regression + backend suite

### Task 16: Final verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && ./venv/Scripts/python.exe -m pytest -q
```
Expected: 44 + new tests pass. 1 pre-existing voice failure is unrelated and acceptable.

- [ ] **Step 2: Run frontend typecheck**

```bash
cd frontend && npx tsc --noEmit && echo OK
```

- [ ] **Step 3: Manual golden path**

1. Open workspace → left rail shows New chat + empty conversations + documents.
2. Click New chat → empty state with chips appears.
3. Click a chip → answer streams in, sources collapsed, no confidence box.
4. Ask a follow-up → condensed query fires (check backend log `[Condense]`).
5. Ask a second question → conversation appears in left rail with title = first question.
6. Click a past conversation → thread reloads.
7. Expand sources → doc name + page shown.
8. Click Share → toast "Link copied", `/share/<slug>` loads the answer.
9. Toggle BM → EN → 中文 → chips change language.
10. Click A⁺ → text grows; refresh → still large.
11. Streaming, voice STT, TTS read-aloud all still work.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/agentic-rag-multidoc
```
