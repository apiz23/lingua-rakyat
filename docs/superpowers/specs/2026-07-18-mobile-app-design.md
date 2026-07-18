# Lingua Rakyat Mobile — v1 Design

Date: 2026-07-18
Status: approved (tech/scope/backend chosen by user via in-session Q&A)

## Goal

Basic mobile client for the existing Lingua Rakyat backend: browse ready
government PDF documents and ask multilingual questions with streaming
answers, sources, and confidence — on a phone, as a real native app.

## Tech

- **Expo (React Native + TypeScript)**, blank-typescript template, in `mobile/`.
- Chosen over PWA (already have responsive web; no new value) and Flutter
  (Dart rewrite, zero reuse). Expo reuses the team's TS knowledge and the
  web app's API contract 1:1.
- Streaming: `expo/fetch` (WinterCG fetch with streaming bodies) — React
  Native's built-in fetch cannot stream, so SSE parsing uses the same
  `data: {json}\n` line protocol as `frontend/lib/api.ts`.
- Storage: `@react-native-async-storage/async-storage` for anon user id,
  session id, and language preference.
- Fonts: Bricolage Grotesque (display) + Atkinson Hyperlegible (body) via
  `@expo-google-fonts/*` — brand requirement from CLAUDE.md.
- No navigation library: two screens, plain state switch in `App.tsx`.

## Backend

- Base URL: `https://lingua-rakyat-ai.vercel.app` (verified live 2026-07-18).
- `GET /api/documents/` → `Document[]` (trailing slash required).
- `POST /api/chat/ask-stream` → SSE events `start | retrieval | token |
  sources | complete | suggestions | error`; body requires `user_id`,
  `document_id`, `document_name`, `session_id`, `question`, plus
  `model_override`, `enable_query_augmentation`, `bypass_cache`,
  `chat_history`, `document_ids`.
- Zero backend changes.

## Scope (v1)

In: ready-doc list with agency badges; chat with streamed tokens, sources
(doc name + page), confidence label, follow-up suggestions; trilingual UI
toggle (ms/en/zh); multi-doc retrieval default ON (all ready docs,
selected doc as anchor); model default `openai/gpt-oss-120b`; anon user id
+ per-doc session id persisted; basic error + 429 rate-limit handling.

Out (v1): upload, voice, PDF viewer, Clerk auth, share links, chat
history restore from server, offline cache, model picker.

## Structure

```
mobile/
  App.tsx                    root: font loading, language state, screen switch
  src/theme.ts               civic green light palette + spacing/type scale
  src/i18n.ts                ms/en/zh copy strings
  src/api.ts                 types, listDocuments(), askQuestionStream()
  src/screens/DocListScreen.tsx
  src/screens/ChatScreen.tsx
```

## Data flow

App.tsx loads fonts + persisted language → DocListScreen fetches
`/api/documents/`, filters `status === "ready"` → tap doc →
ChatScreen(doc, allReadyDocs) → submit question → `askQuestionStream`
posts with `document_ids = all ready ids` → events append streamed text
to the last message → `complete` fills sources/confidence →
`suggestions` renders tappable follow-up chips.

## Error handling

- Fetch failure → inline error state with retry (doc list) / error bubble
  (chat).
- 429 → surface Retry-After wait message, disable composer until elapsed.
- Malformed SSE lines skipped (same as web client).

## Testing

- `npx tsc --noEmit` in `mobile/` must pass.
- Manual: `npx expo start`, scan QR with Expo Go, ask the seeded PTPTN
  myWaqaf doc "Apakah myWaqaf PTPTN?" — expect streamed grounded answer
  with sources.
