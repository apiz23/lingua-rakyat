# Lingua Rakyat

Lingua Rakyat is a multilingual Retrieval-Augmented Generation (RAG) assistant for government service documents. A user uploads an official PDF, asks a question in plain language, and receives a source-grounded answer in English, Bahasa Melayu, or Simplified Chinese.

This repository contains:

- `backend/`: FastAPI API for ingestion, retrieval, chat, and evaluation
- `frontend/`: Next.js web app for document management, chat, and model evaluation
- `Lingua-Rakyat-Link.pdf` and `Lingua-Rakyat-Link.docx`: competition handoff materials and project links

## Problem

Government documents are often difficult for ordinary citizens to understand because they are:

- written in formal or legal language
- published as long PDFs
- not equally accessible across languages
- hard to search for exact eligibility, process, or supporting documents

Lingua Rakyat addresses this by combining document retrieval, multilingual prompting, and plain-language answer generation.

## What The Current System Does

- Uploads text-based PDF documents and chunks them for retrieval
- Stores document files in Supabase and vectors in Pinecone
- Uses Cohere multilingual embeddings for semantic search
- Answers questions with Groq-hosted LLMs using retrieved document context
- Detects user language and routes inputs to supported answer languages
- Supports summary-style questions such as "summarize" and "ringkaskan"
- Offers optional query augmentation for broader multilingual retrieval
- Stores chat history in Supabase
- Tracks evaluation metrics such as ROUGE, BLEU, readability, latency, and confidence
- Provides a browser-based evaluation dashboard with streaming test-suite results

## Core User Flow

1. Upload a government PDF.
2. The backend validates the PDF, extracts text, chunks it, embeds it, and stores vectors under the document namespace.
3. The user opens the workspace and selects a document.
4. The user asks a question in English, Malay, or Chinese.
5. The backend detects language, retrieves relevant chunks, builds a prompt, and generates a grounded answer.
6. The UI shows the answer, retrieval confidence, latency, and source excerpts.

## Repository Structure

```text
lingua-rakyat/
|-- backend/
|   |-- main.py
|   |-- requirements.txt
|   |-- render.yaml
|   |-- routers/
|   |   |-- chat.py
|   |   |-- documents.py
|   |   `-- eval.py
|   `-- utils/
|       |-- rag_pipeline.py
|       |-- evaluation.py
|       |-- data_augmentation.py
|       `-- chat_history.py
|-- frontend/
|   |-- app/
|   |   |-- page.tsx
|   |   |-- workspace/page.tsx
|   |   |-- manage/page.tsx
|   |   |-- eval/page.tsx
|   |   `-- results/page.tsx
|   |-- components/
|   |-- hooks/
|   `-- lib/api.ts
|-- Lingua-Rakyat-Link.docx
|-- Lingua-Rakyat-Link.pdf
`-- README.md
```

## Tech Stack

### Backend

- FastAPI
- SlowAPI
- PyPDF
- Groq API
- Cohere embeddings API
- Pinecone
- Supabase

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Sonner

## Main Pages

- `/`: landing page
- `/workspace`: chat experience for asking questions about a selected document
- `/manage`: upload, list, and delete documents
- `/eval`: evaluation dashboard and streamed test suite
- `/results`: static competition-style showcase page

## Backend API Overview

### Health

- `GET /`: backend health summary
- `GET /docs`: Swagger UI

### Documents

- `POST /api/documents/upload`
- `GET /api/documents/`
- `POST /api/documents/register`
- `POST /api/documents/refresh-chunks`
- `DELETE /api/documents/{document_id}`

### Chat

- `POST /api/chat/ask`
- `POST /api/chat/ask-stream`
- `GET /api/chat/history`
- `DELETE /api/chat/history/{document_id}`

### Evaluation

- `GET /api/eval/report`
- `POST /api/eval/run-test-suite`
- `POST /api/eval/run-test-suite-stream`
- `GET /api/eval/simplify-demo`
- `POST /api/eval/augment-query`
- `GET /api/eval/data-quality`
- `DELETE /api/eval/clear`

## Local Setup

### 1. Backend

Requirements:

- Python 3.11+
- `pip`

Commands:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

Backend will run at `http://localhost:8000`.

### 2. Frontend

Requirements:

- Node.js 18+
- `pnpm`

Commands:

```bash
cd frontend
pnpm install
```

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Then run:

```bash
pnpm dev
```

Frontend will run at `http://localhost:3000`.

## Required Backend Environment Variables

The current codebase depends on the following values:

```env
GROQ_API_KEY=
GROQ_MODEL=
GROQ_MODEL_FAST=
COHERE_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_BUCKET=documents
CHAT_HISTORY_TABLE=lr_chat_messages
ENABLE_QUERY_AUGMENTATION=true
AUGMENTATION_MAX_VARIANTS=4
AUGMENTATION_INCLUDE_PARAPHRASE=true
```

Optional runtime values used by middleware or deployment logic:

```env
DEBUG=false
VERCEL_URL=
FRONTEND_URL=
BACKEND_URL=
```

## Architecture Summary

### Ingestion

- PDF validation checks file type, encryption, size, and page count
- text extraction uses `pypdf`
- chunking uses overlapping word windows
- embeddings are generated with Cohere
- vectors are stored in Pinecone under the document namespace
- metadata and source files are stored in Supabase

### Question Answering

- language is detected with keyword matching, CJK heuristics, and `langdetect`
- optional query augmentation expands the question into multilingual variants
- semantic retrieval pulls relevant chunks from Pinecone
- the prompt is built in the detected output language
- Groq models generate a short, grounded answer from retrieved context only

### Evaluation

- every interaction can contribute latency, readability, and confidence data
- the test suite compares generated answers with built-in reference answers
- metrics include ROUGE-1, ROUGE-2, ROUGE-L, BLEU, exact match, and Flesch-Kincaid grade

## What Is Strong About This Repository

- clear separation between frontend and backend
- practical end-to-end prototype, not just a concept deck
- working upload -> retrieval -> answer loop
- multilingual prompting and retrieval strategy
- built-in evaluation dashboard for demos and judging
- explicit rate limiting and document validation

## Current Limitations

These are the main limitations visible from the current code:

- Text-based PDFs only. Scanned PDFs or image-only PDFs are not handled because OCR is not implemented.
- The primary supported answer languages are English, Bahasa Melayu, and Simplified Chinese. Some other language codes are mapped into those outputs, but full direct support is not implemented for every language mentioned in UI copy.
- Chat history is saved in the backend, but the current frontend does not load and render persisted history yet.
- A streaming chat endpoint exists, but the current chat UI uses the non-streaming `POST /api/chat/ask` route.
- The evaluation `data-quality` endpoint exists, but upload-side quality logging is not currently wired into the document ingestion flow.
- Some competition-facing content in the UI is static or promotional, so this README should be treated as the more reliable technical reference.

## Suggested Demo Flow

For a presentation or judging demo:

1. Open `/manage` and upload an official PDF.
2. Open `/workspace`, select the uploaded document, and ask:
   - "Summarize this document"
   - "Siapa yang layak memohon?"
   - "How do I apply?"
3. Show the answer, confidence, and source excerpts.
4. Open `/eval` and run the streamed test suite on the same document.
5. Show the simplification demo and multilingual query augmentation panel.

## Competition Relevance

Lingua Rakyat is a strong competition project because it is:

- socially relevant: it improves access to public-service information
- technically credible: it uses grounded retrieval rather than unrestricted generation
- measurable: it includes evaluation metrics and a test suite
- demo-friendly: judges can see upload, retrieval, multilingual Q&A, and metrics in one flow
- scalable: the architecture already separates storage, retrieval, inference, and UI

## Submission Notes

- Use `Lingua-Rakyat-Link.pdf` or `Lingua-Rakyat-Link.docx` for the prepared project links and submission materials.
- If you plan to submit this repository externally, review tracked local files and generated folders before packaging the final source snapshot.
