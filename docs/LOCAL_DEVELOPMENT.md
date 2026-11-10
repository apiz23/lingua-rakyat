# Local development

## Prerequisites

- Node.js 20 or newer and pnpm 11.
- Python 3.11 or newer and pip.
- A Clerk **development** instance for rendering the frontend and testing sign-in.
- Optional: Supabase, Cohere, Pinecone, and Groq credentials for document data and AI journeys. Ollama can replace Groq for local generation when installed and configured.

## Clerk development keys

Create or select a Clerk development instance. In its API keys page, copy the publishable key and secret key from that same development instance. Do not use production keys. Copy `frontend/.env.example` to `frontend/.env.local` and fill in:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_API_URL=http://localhost:8000`

The backend validates Clerk tokens using `CLERK_ISSUER`, set to the issuer URL for the same Clerk development instance. This variable is already listed in `backend/.env.example`.

## Backend

From the repository root in PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set the Clerk issuer and the provider variables needed by the features you intend to exercise, then run:

```powershell
uvicorn main:app --reload --port 8000
```

The backend can start without all external providers, but document catalogue/PDF operations need Supabase. Chat and ingestion need the configured embedding, vector, and generation providers. Voice may use Groq and ElevenLabs. Telegram and self-callback operations need their corresponding optional settings. The health liveness route does not require provider calls; readiness checks Supabase catalogue access.

## Frontend

In a second PowerShell window from the repository root:

```powershell
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Clerk keys are required because `ClerkProvider` wraps all routes, including public pages. Sign-in UI can render with development keys; completing authentication requires a Clerk development account. Backend-dependent routes need the local API at port 8000.

## Playwright browser tests

Install the browser once:

```powershell
cd frontend
pnpm exec playwright install chromium
```

Run desktop and mobile Chromium smoke tests:

```powershell
pnpm test:e2e
```

The suite starts its own frontend server on port 3011. Set `PLAYWRIGHT_PORT` to use a different port. Route tests use Clerk development keys. The share, document, conversation, and evaluation requests are stubbed only where the tests need existing backend API responses; no frontend route, layout, navigation, or Clerk boundary is mocked. Authenticated user journeys are not included because they require an actual signed-in test session.

## Environment variables

`backend/.env.example` is the source of truth for backend variables. Core provider settings are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_KEY`, `COHERE_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX`, and either Groq settings (`GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_MODEL_FAST`) or local Ollama settings (`LLM_PROVIDER`, `OLLAMA_MODEL`, `OLLAMA_BASE_URL`). Optional services and rate controls are listed in that file. Never put a service-role key in frontend variables.

## Common errors

- **Missing publishableKey:** `frontend/.env.local` is absent or has no Clerk development publishable key. Restart `pnpm dev` after correcting it.
- **401 from saved-history routes:** sign in with the Clerk development instance that matches `CLERK_ISSUER`.
- **404 or connection errors for `/api/...`:** start the backend and confirm `NEXT_PUBLIC_API_URL` points to `http://localhost:8000`.
- **Supabase readiness failure:** local Supabase URL/key values are missing or mismatched. Use a dedicated development project and never change production values.
- **Playwright browser missing:** run `pnpm exec playwright install chromium`.
