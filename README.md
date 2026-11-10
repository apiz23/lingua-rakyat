# Lingua Rakyat

Multilingual document Q&A for Malaysian public-service information. The web and mobile clients use a FastAPI backend, with Supabase for PostgreSQL and file storage, Pinecone for vector search, and hosted AI services for retrieval and generation.

## Development

Requirements: Python 3.11+, Node.js, and pnpm. Configure backend credentials in `backend/.env` from the local environment template and set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local`.

```powershell
# Terminal 1
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend
pnpm install
pnpm dev
```

The web app runs at `http://localhost:3000`; the backend API is at `http://localhost:8000` and its local OpenAPI UI at `/docs`.

For mobile development, see `mobile/AGENTS.md` and the scripts in `mobile/package.json`. Do not use client-controlled identifiers as authorization.

## Repository layout

- `frontend/`: Next.js web app and tests.
- `backend/`: FastAPI service, ingestion scripts and Python tests.
- `mobile/`: Expo mobile app.
- `supabase/`: database schema and migrations.
- `docs/`: development guides, architecture, operations notes and project assets.
- `.agents/skills/`: shared design skills used for this project.

## Maintained documentation

- [Local development](docs/LOCAL_DEVELOPMENT.md)
- [RISE poster](docs/assets/lingua-rakyat-rise-poster.png)
- [Architecture and API compatibility](docs/ARCHITECTURE.md)
- [Security requirements and release gates](docs/SECURITY.md)
- [Demo booth rate limits](docs/SECURITY.md)

Supabase schema and migrations under `supabase/` and backend route models are the implementation-level references for database and API details. Documentation describes intended constraints; verify status labels against source and deployment evidence.
