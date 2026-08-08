# Lingua Rakyat

**Multilingual RAG Assistant for Malaysian Government Documents**

A Retrieval-Augmented Generation (RAG) system that lets citizens upload official PDFs (LHDN, KWSP, JPN, Immigration, etc.) and ask questions in **Malay, English, or Chinese**, receiving source-grounded answers with confidence scores. Built for the **RISE 2026** innovation competition.

**Live**: [lingua-rakyat.my](https://lingua-rakyat.my) | **Backend**: [lingua-rakyat.onrender.com](https://lingua-rakyat.onrender.com)

---

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, TypeScript 5.9, Tailwind CSS 4, shadcn/ui (40+ components) |
| Auth | Clerk (Google/GitHub OAuth, JWT) |
| Animation | Framer Motion |
| PDF Viewer | react-pdf + pdf.js |
| Markdown | react-markdown + Shiki syntax highlighting |
| i18n | Custom LanguageProvider (EN/MS/ZH) |
| Theme | next-themes (system/light/dark) |
| Analytics | Vercel Analytics + Speed Insights |

### Backend

| Layer | Technology |
|---|---|
| Framework | FastAPI + Uvicorn |
| Rate Limiting | SlowAPI (per-IP, booth mode for demos) |
| Deployment | Render (Python 3.12, Tesseract OCR) |

### AI/ML Services

| Service | Purpose |
|---|---|
| Groq | LLM inference (`openai/gpt-oss-120b` primary, `llama-3.1-8b-instant` fast), Whisper STT |
| Cohere | Multilingual embeddings (`embed-multilingual-v3.0`), cross-encoder reranking |
| ElevenLabs | Text-to-speech (multilingual v2) |
| Tesseract OCR | Fallback for scanned/image PDFs (eng + msa + chi_sim) |

### Databases & Storage

| Service | Purpose |
|---|---|
| Pinecone | Vector database for document chunk embeddings |
| Supabase | PostgreSQL (metadata, chat history, shares, eval records) + file storage (PDFs) |

### Mobile

| Layer | Technology |
|---|---|
| Framework | Expo 54, React Native 0.81 |
| Auth | Clerk Expo |
| Screens | ChatScreen, ProfileScreen |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│   Next.js App Router · shadcn/ui · Tailwind          │
│   Clerk Auth · i18n · Dark/Light · PDF Viewer        │
└─────────────────┬──────────────────┬─────────────────┘
                  │  REST API (HTTPS) │
┌─────────────────▼──────────────────▼─────────────────┐
│                    BACKEND                           │
│   FastAPI · SlowAPI Rate Limit · Clerk JWT Auth       │
│                                                      │
│   ┌────────────────────────────────────────────────┐ │
│   │          RAG PIPELINE (~1900 lines)            │ │
│   │  Ingest → Chunk → Embed → Search → Rerank      │ │
│   │  → Generate → Faithfulness Score               │ │
│   └────────────────────────────────────────────────┘ │
└──────┬───────────┬───────────┬───────────┬───────────┘
       │           │           │           │
  ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
  │Pinecone │ │ Cohere  │ │  Groq   │ │Supabase │
  │ Vector  │ │Embed +  │ │ LLM +   │ │ DB +    │
  │ Search  │ │ Rerank  │ │  STT    │ │Storage  │
  └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

---

## Directory Structure

```
lingua-rakyat/
├── backend/                         # FastAPI Python backend
│   ├── main.py                      # Entry point, CORS, middleware
│   ├── rate_limits.py               # Env-gated rate limits (normal vs booth mode)
│   ├── routers/                     # 8 API routers
│   │   ├── chat.py                  # /api/chat — ask, ask-stream, history
│   │   ├── documents.py             # /api/documents — upload, list, delete, register
│   │   ├── eval.py                  # /api/eval — test suite, metrics, data quality
│   │   ├── voice.py                 # /api/voice — STT (Whisper) + TTS (ElevenLabs)
│   │   ├── share.py                 # /api/share — shared answer links
│   │   ├── feedback.py              # /api/feedback — user feedback
│   │   ├── telegram.py              # /api/telegram — bot integration
│   │   └── user.py                  # /api/user — account merge (anon → signed-in)
│   ├── utils/
│   │   ├── rag_pipeline.py          # Core RAG: ingestion, chunking, retrieval, generation (1896 lines)
│   │   ├── evaluation.py            # ROUGE, BLEU, FK grade, faithfulness metrics
│   │   ├── data_augmentation.py     # Multilingual query augmentation
│   │   ├── chat_history.py          # Supabase chat history CRUD
│   │   ├── shared_answers.py        # Shared answer link storage
│   │   ├── voice_helpers.py         # STT/TTS helpers
│   │   └── auth.py                  # Clerk JWT verification + Supabase client
│   ├── tests/                       # 21 test files
│   ├── sample_docs/                 # Sample PDFs for seeding
│   └── requirements.txt             # 48 Python dependencies
│
├── frontend/                        # Next.js web application
│   ├── app/
│   │   ├── layout.tsx               # Root layout (Clerk, Theme, Language, fonts)
│   │   ├── page.tsx                 # Landing page (bilingual hero, demo video, tech stack)
│   │   ├── (app)/                   # Authenticated routes
│   │   │   ├── layout.tsx           # AppShell wrapper (sidebar + header)
│   │   │   ├── workspace/page.tsx   # Main Q&A chat interface
│   │   │   ├── manage/page.tsx      # Document upload/list/delete
│   │   │   ├── eval/page.tsx        # AI quality dashboard (4 tabs)
│   │   │   ├── benchmark/page.tsx   # Benchmarking lab
│   │   │   ├── results/page.tsx     # RISE 2026 showcase
│   │   │   ├── about/page.tsx       # Architecture reference
│   │   │   └── shares/page.tsx      # Shared answer management
│   │   ├── share/[slug]/page.tsx    # Public shared answer (server component + OG image)
│   │   ├── sign-in/                 # Clerk sign-in
│   │   └── sign-up/                 # Clerk sign-up
│   ├── components/
│   │   ├── ui/                      # 40+ shadcn/ui components
│   │   ├── chat-panel/              # Chat interface (1496 lines main file)
│   │   │   ├── index.tsx            # Streaming Q&A, model selector, voice I/O
│   │   │   ├── message-cards.tsx    # Message rendering
│   │   │   ├── chat-markdown.tsx    # Markdown renderer
│   │   │   ├── pdf-panel.tsx        # In-chat PDF viewer
│   │   │   ├── empty-state.tsx      # Welcome screen with suggested questions
│   │   │   ├── answer-metrics.tsx   # Confidence, latency, faithfulness display
│   │   │   ├── voice-speaker.tsx    # TTS playback button
│   │   │   └── voice-mic-button.tsx # Voice recording button
│   │   ├── app-shell.tsx            # App layout frame
│   │   ├── app-sidebar.tsx          # Left navigation sidebar
│   │   ├── workspace-doc-rail.tsx   # Document list sidebar
│   │   ├── upload-modal.tsx         # Token-gated PDF upload
│   │   ├── language-provider.tsx    # i18n context (EN/MS/ZH)
│   │   ├── theme-provider.tsx       # Dark/light theme
│   │   ├── auth-sync.tsx            # Clerk ↔ anonymous user bridging
│   │   └── offline-provider.tsx     # Offline cache manager
│   ├── hooks/
│   │   ├── useDocuments.ts          # Document fetching/caching
│   │   ├── useVoiceRecorder.ts      # Voice recording (MediaRecorder → WebM/Opus)
│   │   ├── useTTS.ts                # ElevenLabs TTS with speechSynthesis fallback
│   │   └── use-mobile.ts            # Mobile viewport detection
│   └── lib/
│       ├── api.ts                   # All backend API calls (950 lines, types + functions)
│       ├── auth-token.ts            # Clerk auth token bridge
│       ├── offline-cache.ts         # localStorage caching for offline mode
│       ├── i18n/chat.ts             # 60+ UI strings per language
│       └── agency-questions.ts      # Trilingual suggested questions per agency
│
├── mobile/                          # React Native / Expo
│   ├── App.tsx                      # Entry point
│   ├── src/
│   │   ├── screens/
│   │   │   ├── ChatScreen.tsx       # Mobile chat interface
│   │   │   └── ProfileScreen.tsx    # User profile
│   │   ├── api.ts                   # Backend API calls
│   │   ├── i18n.ts                  # Trilingual copy (43 keys per language)
│   │   └── auth-token.ts            # Auth token bridge
│   └── assets/                      # Icons, splash screens
│
├── supabase/                        # Database
│   ├── schema.sql                   # Tables: lr_documents, lr_chat_messages
│   ├── seed_lr_documents.sql        # Featured document seed data
│   └── migrations/                  # 4 migration files
│
└── docs/                            # Documentation
    ├── BOOTH_MODE.md                # Demo booth rate limit instructions
    └── future-improvements.txt      # Roadmap
```

---

## RAG Pipeline

### Ingestion Flow

```
PDF Upload
  → Validate (magic bytes, page limits 1-500, text density)
  → Store to Supabase Storage
  → Text Extraction (PyPDF + Tesseract OCR fallback for scanned pages)
  → Section-Aware Chunking
      (regex headers: bab/bahagian/section/chapter,
       paragraph-based, target: 360 words, max: 520, overlap: 45)
  → Embed (Cohere embed-multilingual-v3.0, batch)
  → Upsert to Pinecone (namespace = document_id, metadata = page + section)
```

### Query/Retrieval Flow

```
User Question
  → Language Detection (keyword-first + langdetect fallback)
  → Query Condensation (standalone rewrite via Groq fast model)
  → Query Augmentation (translate to other languages + paraphrase, optional)
  → Vector Search (batch-embed variants → Pinecone per namespace per variant → dedup)
  → Reranking (Cohere rerank-multilingual-v3.0)
  → Confidence Filtering (≥0.50 strong, ≥0.12 cautious, <0.12 refuse)
  → Context Building (source labels, page numbers, section titles)
  → Generation (Groq LLM, language-matched prompts in en/ms/zh-cn)
  → Faithfulness Scoring (answer grounding via Cohere reranker)
  → Follow-up Suggestions (3 auto-generated questions)
```

### Evidence Modes

| Mode | Threshold | Behavior |
|---|---|---|
| **Strong** | ≥ 0.50 | Full answer with high confidence |
| **Cautious** | ≥ 0.12 | Answer with hedging language |
| **Insufficient** | < 0.12 | Hard refusal, no hallucination |

---

## API Endpoints

| Prefix | Methods | Purpose |
|---|---|---|
| `/api/documents` | `POST` upload, `GET` list, `DELETE` delete, `POST` rename/reindex/seed | PDF lifecycle management |
| `/api/chat` | `POST` ask/ask-stream, `GET` history/conversations, `DELETE` history | Q&A + conversation management |
| `/api/eval` | `GET` report, `POST` record/run-test-suite/run-test-suite-stream, `GET` simplify-demo/augment | Evaluation + metrics |
| `/api/voice` | `POST` transcribe/tts | Voice I/O (Whisper + ElevenLabs) |
| `/api/share` | `POST` create, `GET` retrieve/my, `DELETE` revoke | Shared answer links |
| `/api/feedback` | `POST` submit | Thumbs up/down for Q&A pairs |
| `/api/telegram` | `GET` setup, `POST` webhook | Telegram bot integration |
| `/api/user` | `POST` merge-anon | Anonymous → signed-in user merge |

---

## Authentication

- **Clerk** (OAuth: Google, GitHub) for sign-in/sign-up
- Optional — all pages accessible without auth
- Anonymous users get a UUID stored in `localStorage`
- On sign-in: `POST /api/user/merge-anon` reassigns chat history and shares to Clerk user ID
- Backend verifies Clerk JWT (RS256, JWKS) or falls back to anonymous client ID
- Admin operations (delete, rename, reindex) require an upload token verified against Supabase `token` table

---

## Rate Limiting

| Endpoint | Normal | Booth Mode |
|---|---|---|
| Chat | 30/min | 300/min |
| Voice | 10/min | 120/min |
| Documents | 10/min | 120/min |

Booth mode (`BOOTH_MODE=true`) loosens limits for demo events with shared IPs. Proxy-aware IP resolution (X-Forwarded-For, X-Real-IP).

---

## Multilingual Support

**Three languages**: Malay (`ms`), English (`en`), Chinese (`zh`)

- **Detection**: keyword-first (Malay/Chinese), `langdetect` fallback
- **UI**: 60+ translated strings per language in `lib/i18n/chat.ts`
- **Prompts**: fully translated QA/summary/cautious prompts in en/ms/zh-cn
- **TTS**: male voice (English), female voice (Malay/other)
- **OCR**: Tesseract with `eng+msa+chi_sim`
- **Dialect mapping**: Indonesian → ms, Filipino/Thai/Vietnamese → en, Cantonese → zh-cn

---

## Key Features

- **Trilingual Q&A** — Malay, English, Chinese with auto-detection
- **Streaming Responses** — SSE-based with real-time confidence/latency display
- **Voice Input/Output** — Groq Whisper STT + ElevenLabs TTS
- **In-App PDF Viewer** — source highlighting with page references
- **Document Management** — upload, rename, delete, reindex (admin-protected)
- **Shared Answers** — public shareable links with dynamic OG images
- **Evaluation Dashboard** — ROUGE/BLEU metrics, 30 built-in test cases, faithfulness scoring
- **Offline Support** — localStorage caching, client-side token scoring
- **Anonymous → Authenticated** — seamless user data migration on sign-in
- **Booth Mode** — generous rate limits for demo events
- **Security Headers** — X-Frame-Options DENY, CSP, nosniff, strict referrer policy
- **Civic Design** — Atkinson Hyperlegible (accessibility), deep civic green palette, document-first hierarchy

---

## Design

- **Typography**: Atkinson Hyperlegible (body, accessibility-focused), Space Grotesk (headings), JetBrains Mono (code)
- **Color**: Deep civic green `oklch(0.38 0.13 145)` — authoritative, accessible
- **Theme**: System (light primary, dark secondary)
- **Layout**: Document-centric, left-aligned sidebar navigation, content-first hierarchy
- **Domain**: `lingua-rakyat.my` (production), `lingua-rakyat.vercel.app` (Vercel preview)

---

## Deployment

| Component | Platform | Details |
|---|---|---|
| Frontend | Vercel | `lingua-rakyat.vercel.app`, custom domain `lingua-rakyat.my` |
| Backend | Render | Starter plan, Python 3.12, Tesseract via build command |
| Mobile | Expo | Dev builds (`linguarakyat` scheme) |
| Database | Supabase | PostgreSQL + Storage (`documents` bucket) |
| Vector DB | Pinecone | Index `docuquery`, namespace per document |

---

## Environment Variables

### Backend

```env
# LLM
LLM_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
GROQ_MODEL_FAST=llama-3.1-8b-instant

# Embeddings & Reranking
COHERE_API_KEY=

# Vector Database
PINECONE_API_KEY=
PINECONE_INDEX=docuquery

# Storage & Database
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_BUCKET=documents

# Auth
CLERK_ISSUER=

# Feature Flags
BOOTH_MODE=false
ENABLE_QUERY_AUGMENTATION=true
ENABLE_COHERE_RERANK=true
AUGMENTATION_MAX_VARIANTS=4
AUGMENTATION_INCLUDE_PARAPHRASE=true

# OCR
TESSERACT_LANGS=eng+msa+chi_sim
```

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

---

## Local Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
copy .env.example .env         # Windows
# cp .env.example .env        # macOS/Linux
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
pnpm install
# Create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000
pnpm dev
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

---

## Evaluation Metrics

| Metric | Description |
|---|---|
| ROUGE-1/2/L | N-gram overlap with reference answers |
| BLEU | Precision-based translation quality |
| Exact Match | Binary match against reference |
| Flesch-Kincaid Grade | Readability score (lower = simpler) |
| Faithfulness | Answer grounding via Cohere reranker (0-1) |
| Latency | End-to-end response time (ms) |

---

## Suggested Demo Flow

1. Open `/manage` and upload an official PDF
2. Open `/workspace`, select the uploaded document, and ask:
   - "Summarize this document"
   - "Siapa yang layak memohon?"
   - "How do I apply?"
3. Show the answer, confidence, and source excerpts
4. Open `/eval` and run the streamed test suite on the same document
5. Show the simplification demo and multilingual query augmentation panel

---

## License

Internal project — RISE 2026 competition submission.
