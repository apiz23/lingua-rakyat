# 🌏 Lingua Rakyat — Multilingual AI Assistant for ASEAN Government Services

> **VHack 2026 · Case Study 4 — The Inclusive Citizen: Multilingual AI for Public Services**

Lingua Rakyat is an AI-powered assistant that helps ASEAN citizens understand government services in plain language — in their own language. Upload any government PDF, ask a question in Malay, English, or Chinese, and get a simple bullet-point answer grounded in the official document. No hallucinations. Every answer is sourced directly from the uploaded document.

---

## 📋 Table of Contents

- [What This Project Does](#what-this-project-does)
- [The Problem We're Solving](#the-problem-were-solving)
- [Live Demo Pages](#live-demo-pages)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [Setup — Backend](#setup--backend)
- [Setup — Frontend](#setup--frontend)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Evaluation & Metrics](#evaluation--metrics)
- [Performance Benchmarks](#performance-benchmarks)
- [Impact KPIs & Success Metrics](#impact-kpis--success-metrics)
- [Rate Limits](#rate-limits)
- [Running the Evaluation Suite](#running-the-evaluation-suite)
- [Key Features](#key-features)
- [File Guide for Teammates](#file-guide-for-teammates)
- [Known Limits](#known-limits)
- [SDG Alignment](#sdg-alignment)
- [Team Roles](#team-roles)
- [Future Improvements](#future-improvements)

---

## What This Project Does

A citizen uploads a Malaysian government PDF (e.g. FAQ SUMBANGAN ASAS RAHMAH, STR application guide, NUP housing policy). They type a question in any language. The system:

1. Detects the language automatically (supports 15+ SEA languages and dialects)
2. Searches the document for the most relevant passages using vector similarity
3. Generates a simplified, 5th-grade reading level answer in the same language
4. Shows which part of the document it used — with a confidence score

**Example interaction:**

User:
```
Bagaimana nak mohon bantuan perumahan?
```

AI response:
```
• Semak kelayakan anda di portal rasmi kerajaan.
• Sediakan dokumen seperti IC dan penyata pendapatan terkini.
• Hantar permohonan melalui laman web kerajaan.
• Tempoh kelulusan biasanya 14–30 hari.

Sumber: Berdasarkan dokumen rasmi yang disediakan.
```

---

## The Problem We're Solving

ASEAN has 700 million+ citizens. Most government portals are English-only and written in dense legal jargon. This leaves behind:

- 👴 **Elderly citizens** — unfamiliar with English and digital systems
- 🏘️ **Rural communities** — low digital literacy, dialect speakers
- 👷 **Migrant workers** — different native language entirely
- 📚 **Low-literacy users** — cannot parse bureaucratic language

Our solution bridges this information gap using RAG (Retrieval-Augmented Generation). The AI only answers from real official documents — never guesses.

---

## Live Demo Pages

| Page | URL | Purpose |
|---|---|---|
| Landing | `/` | Project overview |
| Workspace | `/workspace` | Main chat interface for citizens |
| Manage | `/manage` | Upload and manage documents |
| Eval Dashboard | `/eval` | Performance metrics, test suite, jargon demo |

---

## Project Structure

```
lingua-rakyat/
│
├── backend/                        ← FastAPI backend (Python)
│   ├── main.py                     ← App entry point, middleware, rate limiting
│   ├── requirements.txt            ← Python dependencies
│   ├── render.yaml                 ← Render deployment config
│   ├── .env.example                ← Copy this to .env and fill in keys
│   │
│   ├── routers/
│   │   ├── chat.py                 ← POST /api/chat/ask — the main Q&A endpoint
│   │   ├── documents.py            ← Upload, list, delete documents
│   │   └── eval.py                 ← Metrics, test suite, augmentation
│   │
│   └── utils/
│       ├── rag_pipeline.py         ← ⭐ Core logic: embed → retrieve → generate
│       ├── evaluation.py           ← ROUGE/BLEU scoring, 30 annotated test cases
│       └── data_augmentation.py    ← Jargon simplification, query augmentation
│
├── frontend/                       ← Next.js frontend (TypeScript)
│   ├── app/
│   │   ├── page.tsx                ← Landing page
│   │   ├── workspace/page.tsx      ← Main chat page
│   │   ├── manage/page.tsx         ← Document management
│   │   └── eval/page.tsx           ← Evaluation dashboard
│   │
│   ├── components/
│   │   ├── chat-panel.tsx          ← ⭐ Chat UI with model selector
│   │   ├── doc-panel.tsx           ← Document list sidebar
│   │   └── upload-modal.tsx        ← PDF upload dialog
│   │
│   └── lib/
│       └── api.ts                  ← All API calls + GROQ_MODELS list
│
└── README.md                       ← You are here
```

---

## Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| FastAPI | 0.111.0 | REST API framework |
| LangChain | 1.2.12 | RAG orchestration |
| langchain-groq | 1.1.2 | Groq LLM integration |
| pinecone | 6.0.0 | Vector database client |
| supabase | 2.28.2 | File storage + metadata |
| pypdf | 6.9.1 | PDF text extraction |
| langdetect | 1.0.9 | Language detection |
| slowapi | 0.1.9 | Rate limiting |

### Frontend
| Package | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | React framework |
| TypeScript | — | Type safety |
| Tailwind CSS | — | Styling |
| ShadCN UI | — | Component library |
| Framer Motion | 12.36.0 | Animations |
| Sonner | 2.0.7 | Toast notifications |
| Lucide React | 0.577.0 | Icons |

### External Services
| Service | What We Use It For | Free Tier |
|---|---|---|
| **Groq** | LLM inference (fast, free tier) | llama-4-scout: 30K TPM · 500K/day |
| **Cohere** | Multilingual embeddings (1024-dim) | 1000 calls/month |
| **Pinecone** | Vector similarity search | 2GB serverless |
| **Supabase** | PDF file storage + metadata JSON | 500MB storage |

> **Note:** The original plan used ChromaDB + BGE embeddings + Ollama (local). These were replaced with Pinecone + Cohere + Groq for cloud deployment on Render's free tier (512MB RAM limit — local models don't fit).

---

## How It Works

### When a user asks a question

```
User types question (any language)
        ↓
1. Language detection
   — keyword match (Malay/Chinese dialect words)
   — CJK character ratio check
   — langdetect library fallback
        ↓
2. Intent detection
   — SUMMARY? ("ringkaskan", "summarize", "总结", "overview")
   — QUESTION? ("how do I", "siapa yang layak", "如何申请")
        ↓
3. Embed the query — Cohere embed-multilingual-v3.0 (1024-dim)
   — Summary → embed "document overview summary key points"
   — Question → embed the actual question
        ↓
4. Vector search in Pinecone
   — Summary: top 8 chunks, skip confidence filter
   — Question: top 5 chunks, filter by score ≥ 0.50
        ↓
5. Build prompt (EN / MS / ZH-CN)
   — 2 few-shot examples per language
   — Summary intent → dedicated summary prompt
   — Q&A intent → Q&A prompt with context + question
        ↓
6. LLM generates simplified bullet-point answer
   — Primary:  meta-llama/llama-4-scout-17b-16e-instruct (chat)
   — Fallback: qwen/qwen3-32b → gemma2-9b-it (on 429/413)
        ↓
7. Return to frontend
   — answer, language, sources[], confidence, latency_ms, model_used
   — Cache result (LRU 200 entries)
```

### When a user uploads a PDF

```
User uploads PDF
        ↓
1. Validate — pages, text length, empty page ratio
        ↓
2. Extract text — PyPDF
        ↓
3. Chunk — 1000 words, 200 overlap, min 20 words/chunk
        ↓
4. Embed — Cohere (search_document input type)
        ↓
5. Upsert to Pinecone — namespace = document UUID
        ↓
6. Store PDF in Supabase — {uuid}/{original_filename}.pdf
        ↓
7. Save metadata — metadata.json in Supabase
```

---

## Setup — Backend

### Prerequisites
- Python 3.11+
- pip

### Steps

```bash
# 1. Go to backend folder
cd backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy env file and fill in your API keys
cp .env.example .env

# 5. Run the server
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`
Health check: `http://localhost:8000/health`

---

## Setup — Frontend

### Prerequisites
- Node.js 18+
- pnpm (recommended)

### Steps

```bash
# 1. Go to frontend folder
cd frontend

# 2. Install dependencies
pnpm install

# 3. Create env file
cp .env.example .env.local
# Set: NEXT_PUBLIC_API_URL=http://localhost:8000

# 4. Run dev server
pnpm dev
```

Frontend runs at `http://localhost:3000`

---

## Environment Variables

### Backend `.env`

```env
# ── LLM (Groq) ────────────────────────────────────────────────────────────────
# Get free key at: https://console.groq.com
GROQ_API_KEY=your_groq_api_key_here

# Chat model — 30K tokens/min, 500K/day
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# Eval/bulk model — 6K tokens/min, 500K/day
GROQ_MODEL_FAST=qwen/qwen3-32b

# ── Embeddings (Cohere) ───────────────────────────────────────────────────────
# Get free key at: https://dashboard.cohere.com/api-keys
COHERE_API_KEY=your_cohere_api_key_here

# ── Vector Database (Pinecone) ────────────────────────────────────────────────
# Get free key at: https://app.pinecone.io
# Create index: Name=lingua-rakyat, Dimensions=1024, Metric=cosine, Cloud=AWS, Region=us-east-1
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=lingua-rakyat

# ── File Storage (Supabase) ───────────────────────────────────────────────────
# Get keys at: https://app.supabase.com → Settings → API
# Create Storage bucket named "documents" (set to Public)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key_here
SUPABASE_BUCKET=documents
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
# Production: NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## API Reference

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/ask` | Ask a question about a document |
| `GET` | `/api/chat/history` | Get chat history for a document |
| `DELETE` | `/api/chat/history/{document_id}` | Clear chat history |

**POST `/api/chat/ask` — request:**
```json
{
  "document_id": "abc-123-uuid",
  "document_name": "FAQ_STR_2026.pdf",
  "question": "macam mana nak mohon?",
  "model_override": ""
}
```

**Response:**
```json
{
  "answer": "• Anda perlu mengisi borang permohonan...",
  "language": "ms",
  "confidence": 0.847,
  "latency_ms": 2341,
  "model_used": "meta-llama/llama-4-scout-17b-16e-instruct",
  "sources": [
    { "text": "...", "score": 0.847, "document_id": "abc-123" }
  ]
}
```

### Documents

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/upload` | Upload a PDF (rate limited: 10/min) |
| `GET` | `/api/documents/` | List all uploaded documents |
| `DELETE` | `/api/documents/{id}` | Delete a document |

### Evaluation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/eval/report` | Live performance metrics |
| `POST` | `/api/eval/run-test-suite` | Run 30-case annotated test suite |
| `POST` | `/api/eval/run-test-suite-stream` | Same but streams via SSE |
| `GET` | `/api/eval/data-quality` | Data quality report for all docs |
| `POST` | `/api/eval/augment-query` | Expand query into 5 SEA languages |
| `GET` | `/api/eval/simplify-demo` | Jargon simplification examples |
| `DELETE` | `/api/eval/clear` | Clear all eval records |

---

## Evaluation & Metrics

The `/eval` dashboard shows live metrics collected from every chat query automatically.

### Metrics tracked

| Metric | What it measures | Target |
|---|---|---|
| **ROUGE-1 F1** | Unigram word overlap vs ground truth | ≥ 0.35 |
| **ROUGE-2 F1** | Bigram overlap vs ground truth | ≥ 0.15 |
| **ROUGE-L F1** | Longest common subsequence | ≥ 0.30 |
| **BLEU** | N-gram precision vs ground truth | ≥ 0.15 |
| **Exact Match** | % of answers exactly matching ground truth | — |
| **Flesch-Kincaid** | Readability grade level | ≤ 6 (5th grade) |
| **p50 Latency** | Median end-to-end response time | < 2,000ms |
| **p95 Latency** | 95th percentile response time | < 5,000ms |
| **Avg Confidence** | Mean Pinecone retrieval score | ≥ 0.50 |

### Test suite — 30 annotated cases

| Category | Cases | Languages |
|---|---|---|
| 🏠 Housing | 9 | EN, MS |
| 🎓 Student Loans (PTPTN) | 8 | EN, MS |
| 🏥 Healthcare (PeKa B40) | 7 | EN, MS |
| 🤝 Social Welfare (BR1M/STR) | 3 | MS, ZH-CN |
| 🛂 Immigration | 2 | EN, ZH-CN |

> The test suite auto-detects the document category from its filename and only runs matching cases. Uploading a housing PDF runs 9 housing cases. Uploading an unrelated document (e.g. Data Sharing Act) shows a warning instead of producing misleading scores.

---

## Performance Benchmarks

Measured from the live evaluation dashboard during testing against the built-in 30-case annotated dataset.

| Metric | Recorded | Target |
|---|---|---|
| **p50 Latency** | ~1,200ms | < 2,000ms ✅ |
| **p95 Latency** | ~3,100ms | < 5,000ms ✅ |
| **Avg Retrieval Confidence** | 72% | ≥ 50% ✅ |
| **Answers above confidence threshold** | 89% | ≥ 80% ✅ |
| **Avg Flesch-Kincaid Grade** | 4.8 | ≤ 6 ✅ |
| **Simple language rate** | 91% | ≥ 80% ✅ |
| **ROUGE-1 F1** | 0.41 | ≥ 0.35 ✅ |
| **BLEU Score** | 0.19 | ≥ 0.15 ✅ |

To reproduce: `POST /api/eval/run-test-suite` with any matched document, or use the `/eval` dashboard.

### Infrastructure cost at scale

| Users/Month | Est. Cost | Notes |
|---|---|---|
| 1,000 | ~$0 | Within all free tiers |
| 10,000 | ~$15/month | Groq + Cohere usage only |
| 100,000 | ~$150/month | Upgrade Render + Supabase Pro |
| 1,000,000 | ~$800/month | Enterprise tiers + CDN |

---

## Impact KPIs & Success Metrics

### Year 1 Targets (2026)

| KPI | Target | Measurement |
|---|---|---|
| Monthly active users | 10,000 | Analytics dashboard |
| Government portals integrated | 3 | Partnership agreements |
| Languages supported | 5 (EN, MS, ZH, ID, TL) | Language detection logs |
| User satisfaction score | ≥ 80% | Post-chat thumbs up/down |
| Avg response time | < 2s (p50) | `/api/eval/report` |
| Simplification target met | ≥ 85% answers at grade ≤ 6 | Flesch-Kincaid scores |
| Retrieval accuracy | ≥ 75% avg confidence | Pinecone retrieval scores |

### Year 3 Targets (2028)

| KPI | Target |
|---|---|
| Monthly active users | 500,000 |
| ASEAN countries active | 5 (MY, ID, PH, TH, SG) |
| Government clients | 15 ministries/departments |
| Languages & dialects | 10+ |
| Annual revenue (B2G SaaS) | MYR 500,000+ |

### How we measure accessibility impact

- **Readability:** Every AI response is auto-scored with Flesch-Kincaid. Target: grade ≤ 6 (primary school reading level)
- **Language inclusion:** % of queries answered in the user's detected language (not defaulted to English)
- **Confidence-gating:** % of answers that pass the 50% retrieval threshold — only confident answers are shown

---

## Rate Limits

To ensure fair access and prevent abuse:

| Endpoint | Limit |
|---|---|
| `POST /api/chat/ask` | 30 requests/minute per IP |
| `POST /api/documents/upload` | 10 uploads/minute per IP |
| `GET /api/eval/*` | 200 requests/minute per IP |
| Global default | 200 requests/minute per IP |

Rate limit responses return HTTP `429` with a `Retry-After` header. The frontend automatically shows a toast with the wait time remaining.

---

## Running the Evaluation Suite

```bash
# 1. Start the backend
uvicorn main:app --reload --port 8000

# 2. Upload a government PDF
curl -X POST http://localhost:8000/api/documents/upload \
  -F "file=@housing_policy.pdf"

# 3. Run the 30-case annotated test suite
curl -X POST http://localhost:8000/api/eval/run-test-suite \
  -H "Content-Type: application/json" \
  -d '{"document_id": "<your-doc-id>", "doc_name": "housing_policy.pdf"}'

# 4. Get the full metrics report
curl http://localhost:8000/api/eval/report
```

Or use the **Evaluation Dashboard** in the frontend at `/eval` — includes live streaming progress, category filter, and per-case ROUGE/BLEU breakdown.

---

## Key Features

### 1. Multilingual support
Detects 15+ SEA languages. Priority: keyword matching (Malay/Chinese dialects) → CJK character ratio → langdetect. Dialect map handles Javanese → Malay, Cantonese → Chinese, Tagalog → English automatically.

### 2. Policy simplification
Government jargon is simplified before answers are shown. 40+ bureaucratic terms (EN + MS) are replaced with plain equivalents. Every answer targets a 5th-grade (FK grade ≤ 6) reading level.

Original:
```
Applicants must submit supporting documentation prior to approval.
```
Simplified:
```
Anda perlu hantar dokumen sebelum permohonan boleh diluluskan.
```

### 3. Policy summarisation
When a user asks "ringkaskan", "summarize", or "总结" — the system detects summarisation intent and switches strategy: retrieves more chunks broadly, skips the confidence filter, and uses a dedicated summary prompt.

```
Housing Aid Summary
• Who is eligible
• Required documents
• How to apply
• Timeline
```

### 4. Confidence-gated responses
Every answer shows the source chunks used, with a colour-coded confidence bar. Green ≥75%, blue ≥50%, orange below. Users can verify answers come directly from the real document — no guessing.

### 5. Dual model system
- **Chat queries** → `llama-4-scout-17b` (30K TPM, best for real-time)
- **Eval test suite** → `qwen3-32b` (500K daily, best for bulk runs)
- **Auto-fallback** → 429/413 → fast model → `gemma2-9b-it`

### 6. Few-shot prompting
Every prompt includes 2 worked Q&A examples in the detected language. Teaches the LLM the exact bullet-point format and prevents format drift across different document types.

### 7. Live streaming test suite
30-case test suite streams results one by one via SSE. Each case appears on screen as it completes — no waiting 60+ seconds for all results.

### 8. Model selector
Both chat and eval have a dropdown to switch between 10 Groq models. Shows TPM and daily token limits per model.

---

## File Guide for Teammates

### "I want to understand the core AI logic"
→ `backend/utils/rag_pipeline.py` — read `answer_question()`. This single function is the entire pipeline from language detection to LLM call.

### "I want to add a new language"
→ Edit `DIALECT_MAP` and `DIALECT_KEYWORDS` in `rag_pipeline.py`. Add prompts to the `prompts` dict in `answer_question()`. Add the language to `LANG_LABELS` in `frontend/app/eval/page.tsx`.

### "I want to add more test cases"
→ Edit `BUILT_IN_TEST_CASES` in `backend/utils/evaluation.py`. Each case needs `question`, `ground_truth`, `language`, and `category`.

### "I want to change the LLM model"
→ Edit `.env`: `GROQ_MODEL` (chat) or `GROQ_MODEL_FAST` (eval). See all models with rate limits in `frontend/lib/api.ts` → `GROQ_MODELS`.

### "I want to add a new API endpoint"
→ Add to the router in `backend/routers/`. Add the function to `frontend/lib/api.ts`.

### "I want to change the UI"
→ Chat: `frontend/components/chat-panel.tsx`
→ Doc list: `frontend/components/doc-panel.tsx`
→ Eval page: `frontend/app/eval/page.tsx`

### "The app is showing 429 errors"
→ Groq model hit its daily or per-minute limit. System auto-retries with fallback. If still failing, wait until midnight UTC for daily reset, or change `GROQ_MODEL` in `.env`.

### "I uploaded a PDF but it shows 0 chunks"
→ PDF is likely scanned/image-based. Try a PDF with selectable text. Check `GET /api/eval/data-quality` for quality details.

### "Summarise is not working"
→ Check the question contains a summarise keyword — "summarize", "ringkaskan", "总结", "overview", "ringkasan". Full list in `SUMMARIZE_KEYWORDS` in `rag_pipeline.py`.

---

## Known Limits

| Limit | Value | Reason |
|---|---|---|
| Chat requests | 30/min per IP | Groq rate limit protection |
| PDF uploads | 10/min per IP | Cohere embedding quota |
| Max PDF pages | 500 | Chunking performance |
| Max context per query | 4,000 chars (~1,000 tokens) | TPM budget |
| Query cache | 200 entries LRU | In-memory, resets on restart |
| Full prompt support | EN, MS, ZH-CN | Dedicated prompts + few-shot |
| Language detection | 15+ SEA languages | Dialect map + langdetect |
| PDF type | Text-based only | No OCR for scanned PDFs |

---

## SDG Alignment

This project directly supports **UN SDG 10 — Reduced Inequalities**, Target 10.2:

> *"By 2030, empower and promote the social, economic and political inclusion of all, irrespective of age, sex, disability, race, ethnicity, origin, religion or economic or other status."*

By making government services accessible in plain language across multiple languages, Lingua Rakyat removes a key barrier to civic participation for marginalised ASEAN communities.

---

## Team Roles

| Role | Responsibilities |
|---|---|
| **AI Engineer** | RAG pipeline, embeddings, vector search, language detection, evaluation metrics |
| **Backend Developer** | FastAPI endpoints, Supabase integration, rate limiting, deployment |
| **Frontend Developer** | Next.js chat UI, eval dashboard, model selector, upload modal |
| **Data Engineer** | Government PDF collection, test case annotation, jargon dictionary |

---

## Future Improvements

| Phase | Timeline | Features |
|---|---|---|
| Phase 1 — Launch | Now · Q2 2026 | Malaysia pilot · 3 portals · Web app ✅ |
| Phase 2 — Expand | Q4 2026 | Voice input (Whisper) · WhatsApp · SEA-LION local model |
| Phase 3 — Scale | Q2 2027 | Mobile app · Indonesia + Singapore · API marketplace |
| Phase 4 — Sustain | 2028+ | 5 ASEAN countries · 15 gov clients · MYR 500K revenue |

---

*Built for VHack 2026 · Lingua Rakyat Team*
