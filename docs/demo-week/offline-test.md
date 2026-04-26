# Offline Demo-Booth Test

## What Was Added

- App shell caching through `frontend/public/sw.js`.
- Cached document list through `localStorage`.
- Cached chat history through `localStorage`.
- Cached retrieved source excerpts for basic offline search.
- Offline indicator in the bottom-right corner.

## Expected Behavior

Works offline after the device has already loaded the app and asked at least one online question for that document.

Offline mode can:

- Reopen the workspace app shell.
- Show cached documents.
- Show cached chat history.
- Answer similar questions from cached source excerpts.
- Show cached citations when available.

Offline mode cannot:

- Upload a new PDF.
- Run OCR/extraction.
- Create Cohere embeddings.
- Query Pinecone.
- Call Groq for a new LLM answer.

## Manual Test Steps

1. Start app while online.
2. Open `http://localhost:3000/workspace`.
3. Upload or select an LHDN document.
4. Ask: `Siapa yang layak untuk pelepasan cukai ini?`
5. Open Sources so citations are visible.
6. Disable WiFi.
7. Refresh the workspace page.
8. Select the same cached document.
9. Ask a similar question:
   `Apa syarat kelayakan pelepasan cukai ini?`
10. Confirm:
   - Offline badge appears.
   - App does not crash.
   - Cached answer appears.
   - Source excerpts appear if previously cached.

## Pass/Fail Notes

| Area | Expected | Result |
|---|---|---|
| Workspace loads offline | App shell opens | Pending manual WiFi-off test |
| Documents visible | Cached list appears | Pending manual WiFi-off test |
| Chat does not crash | Offline answer generated | Pending manual WiFi-off test |
| Citations visible | Cached source excerpts shown | Pending manual WiFi-off test |

## Demo Booth Advice

Before the booth starts, open the app online and ask one Malay and one English question for the demo PDF. That primes the offline cache.
