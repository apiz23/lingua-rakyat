# Conversation-First Chat Redesign — Design

**Date:** 2026-06-12
**Status:** Approved (brainstorm), pending implementation plan
**Branch base:** builds on `feat/agentic-rag-multidoc` (multi-doc-default already shipped)

## Goal

Restructure the workspace from **document-first** ("pick a file, then chat") to
**conversation-first** ("your chats are the spine; documents are a background
resource"), matching the interaction pattern of Claude / ChatGPT / Gemini while
staying rakyat-friendly (accessible to elderly, low-literacy, and non-technical
Malaysian citizens).

This builds directly on the multi-document-default change already shipped: every
question now searches the whole ready library by default, so the old required
document picker is obsolete.

### Non-goals

- True agentic retrieval loop (deferred — latency/flakiness).
- Agency quick-start cards on the empty state (empty-state variant B — deferred).
- Source page-highlight overlay on the PDF viewer (deferred).
- A separate "Senang Mode" — accessibility is folded into the one redesign
  (language + text-size switch), not a parallel UI.

## Users

Malaysian citizens of all ages asking about government PDFs in Malay, English,
or Chinese. Many will not know what to type into a blank box; many are elderly or
low-literacy. Primary surface: desktop and mobile web.

## Architecture

### Shell layout — three regions

**Left rail** (collapsible; mobile = slide-over drawer)
- `New chat` button (primary, top).
- **Conversations list** — past chats, newest first. Each row: title (first
  question, truncated) + relative time. Active conversation highlighted.
- **Your documents** section below — list of ready/processing docs + `＋ Upload`.
  Default behavior unchanged: questions search all ready docs. Tapping one doc
  scopes the next question to it (shows a chip in the composer); tapping again or
  an "All documents" control clears the scope.

**Center**
- **Empty state** (no active conversation / new chat): centered greeting +
  4–6 tappable example-question chips rendered in the current UI language. One
  tap submits that question immediately. MVP: chips are a curated static list per
  language (BM/EN/中文) defined in frontend copy — not generated. Dynamic /
  popular-question chips are a later optimization.
- **Thread**: message bubbles (user right, assistant left), auto-scroll.
- **Composer** pinned to the bottom: `＋` (upload / attach a PDF), text input,
  small `🎤` mic (existing voice STT), send button. Stop button while streaming.

**Answer card** (assistant bubble)
- Answer text (respects current text-size setting).
- Toolbar: `🔊` read-aloud (existing TTS), `👍/👎` feedback, `↗` share, `⧉` copy.
- **Collapsed sources**: a single line "Sources: <doc> · p.<n>" that expands to
  the full source list (doc name + page per source). Multi-doc answers list each
  contributing document.
- **Confidence line**: on low / weak-evidence answers, one plain sentence
  ("Padanan lemah — sahkan di sumber rasmi" / "Weak match — verify with the
  official source").

### Conversations model — minimal backend

A "conversation" is a `session_id` grouping of existing rows in
`lr_chat_messages`. **No schema migration for MVP.**

- **New endpoint** `GET /api/chat/conversations?user_id=<id>`:
  groups `lr_chat_messages` by `session_id` (scoped to `user_id`), returns a list
  of `{ session_id, title, last_at, count }` ordered by `last_at` desc.
  `title` = the earliest question in that session (truncated server-side).
- **New chat** = a fresh uuid `session_id`, **doc-independent** (not keyed to a
  document, unlike today's `lr-chat-session-id:<docId>`). The browser stores the
  active `session_id` directly.
- **Load a conversation** = existing `GET /api/chat/history?session_id=<id>`.
- **Delete a conversation** = existing `DELETE /api/chat/history/...` extended to
  delete by `session_id` (the underlying `delete_chat_messages` already supports
  a `session_id` filter).

Implementation note: grouping can be done in Python over the rows returned by a
`select` ordered by `created_at`, or via a Supabase RPC/view. MVP uses the
in-Python grouping path to avoid a migration; a `lr_conversations` view or a
`title` column is a later optimization, not required.

### Rakyat-friendly touches (selected)

| # | Touch | State |
|---|-------|-------|
| 1 | Read-aloud per answer (TTS) | Already built — keep prominent in toolbar |
| 2 | Share answer link | **New**: store answer → slug → public `/share/<slug>` page |
| 3 | Collapsed sources w/ doc + page | Mostly built — restyle to collapsed line |
| 4 | Confidence + "verify official" sentence | **New** (confidence-explanation, future-improvements #80) |
| 6 | Language + A⁺ text-size switch | Always reachable in header; text-size persisted |

Excluded: #5 large voice-first button (keep the small mic only).

#### Share link (touch #2)
- **Backend**: store `{ slug, question, answer, sources, language, created_at }`
  in a new `lr_shared_answers` table. `POST /api/share` → returns slug.
  `GET /api/share/<slug>` → the stored payload.
- **Frontend**: `↗` on an answer calls `POST /api/share`, copies the resulting
  `/share/<slug>` URL (WhatsApp-friendly). A minimal public read-only
  `/share/<slug>` page renders the question + answer + sources, no auth.

#### Confidence sentence (touch #4)
- Reuse the existing confidence score + faithfulness already on the result.
- When confidence is low or evidence insufficient, render one plain-language
  sentence in the answer card (localized BM/EN/中文). No new model call.

#### Language + text-size (touch #6)
- Language switch already exists (copy is bilingual today); surface BM/EN/中文 in
  the header consistently across the shell.
- Text-size: a small `A⁺` control toggling a root font-scale class
  (e.g. `text-base` → `text-lg`/`text-xl`), persisted to localStorage. Applies
  app-wide; respects existing Atkinson Hyperlegible body font.

## Data flow

1. App loads → fetch `GET /api/chat/conversations?user_id` → render left-rail list.
2. `New chat` → generate uuid session_id → center shows empty state with chips.
3. Citizen taps a chip or types → `POST /api/chat/ask-stream` with the active
   `session_id`, `document_ids` (all ready, or the scoped one), `chat_history`.
   Streaming tokens render into the answer card.
4. On completion the message persists via existing `insert_chat_message`; the
   left-rail conversation list refreshes (the new session now appears with its
   title = the first question).
5. Selecting a past conversation → `GET /api/chat/history?session_id` → hydrate
   the thread.
6. `↗` Share → `POST /api/share` → copy `/share/<slug>`.

## Components / boundaries

- **`chat-panel/index.tsx`** is currently a 1361-line component doing too much
  (state, history, composer, message rendering, settings). The redesign is a good
  occasion to split it into focused units so each can be reasoned about and tested
  independently:
  - `ConversationSidebar` — new-chat + conversation list + document section.
  - `ChatThread` / `MessageCard` — message rendering, answer toolbar, sources.
  - `Composer` — input, attach, mic, send/stop.
  - `EmptyState` — greeting + example chips.
  - `chat-panel/index.tsx` becomes the orchestrator wiring these together +
    owning session/conversation state.
- Backend additions are isolated: a `conversations` listing in `routers/chat.py`
  (+ a `chat_history` grouping helper) and a small `routers/share.py` +
  `utils/shared_answers.py`. No change to the RAG pipeline.

## Error handling

- Conversations endpoint failure → left rail shows an empty list, never blocks the
  composer (chat still works with a fresh session).
- Share endpoint failure → toast "Couldn't create link, try again"; answer
  unaffected.
- Offline / fetch failure on document list → multi-doc silently falls back to the
  anchored doc (existing behavior).
- Loading a conversation with stale/deleted docs → answer history still renders;
  source links to missing docs degrade gracefully.

## Phasing

One coherent spec, implemented in phases (each independently shippable):

1. **Shell + conversations sidebar** — structural backbone: 3-region layout,
   `New chat`, `/api/chat/conversations`, doc-independent sessions, load/switch
   threads, delete conversation.
2. **Empty state + composer** — greeting + example chips, composer (`＋`/mic/send),
   document section in the rail with scope chip.
3. **Answer-card touches** — collapsed sources restyle, confidence sentence,
   share link (`lr_shared_answers`, `/api/share`, `/share/<slug>` page).
4. **Language + text-size + a11y polish** — header language switch, `A⁺`
   text-size, keyboard/focus/contrast pass across the new components.

## Testing

- **Backend (pytest)**:
  - `/api/chat/conversations` grouping — multiple sessions for one user group
    correctly, title = earliest question, ordered by last_at.
  - Share: `POST /api/share` stores + returns slug; `GET /api/share/<slug>`
    round-trips; unknown slug → 404.
  - Confidence sentence selection logic (low vs sufficient).
- **Frontend**: `npx tsc --noEmit`; component-level checks for sidebar render and
  empty-state chip submit.
- **Manual**: new chat → ask → appears in sidebar with title; switch threads;
  multi-doc answer lists multiple source docs; scope to one doc via rail; share
  link opens public page; read-aloud; text-size persists; BM/EN/中文.

## Compatibility / risk

- Booth-proven component — phased rollout, keep streaming + history contracts
  intact. Existing `/ask`, `/ask-stream`, `/history`, multi-doc `document_ids`
  are unchanged.
- Messaging bots (Telegram/WhatsApp) and eval routers are untouched — they don't
  use the workspace UI or conversations endpoint.
- No migration required for phase 1–2; phase 3 adds one new table
  (`lr_shared_answers`) used only by the share feature.
