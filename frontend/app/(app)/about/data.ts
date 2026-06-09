// frontend/app/(app)/about/data.ts
import type { ComponentType } from "react"
import {
  Shield, FileSearch, Layers, Brain, Database,
  Globe, Languages, Search, Target, Cpu, Activity,
  Mic, BarChart3, FileText, Zap,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

export type StackItem = {
  name: string
  role: string
  color: string
  what: string
  why: string
}

export type PipelineStepData = {
  n: string
  title: string
  items: string[]
  icon: ComponentType<{ className?: string }>
}

export type FeatureItem = {
  icon: ComponentType<{ className?: string }>
  label: string
  color: string
  bg: string
  points: string[]
}

export type MetricItem = {
  name: string
  icon: ComponentType<{ className?: string }>
  what: string
  detail: string
  range: string
}

export type ApiEndpoint = {
  method: string
  path: string
  desc: string
}

// ── Tech Stack ─────────────────────────────────────────────────────────────

export const BACKEND_STACK: StackItem[] = [
  {
    name: "FastAPI",
    role: "API Framework",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    what: "Python async web framework. Auto-generates Swagger docs at /docs. High throughput via async I/O.",
    why: "Serves all endpoints — chat, documents, eval, voice — with automatic OpenAPI documentation for judges.",
  },
  {
    name: "Groq LLaMA 3.3 70B",
    role: "Answer Generation",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    what: "Meta's open-source LLM (70B params) running on Groq's custom LPU inference hardware. Extremely fast token generation.",
    why: "Generates grounded, source-cited answers in Malay, English, or Chinese from retrieved document context.",
  },
  {
    name: "LLaMA 3.1 8B (Groq)",
    role: "Fast Model",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    what: "Smaller, faster variant of LLaMA for low-latency tasks where full 70B is overkill.",
    why: "Generates follow-up question suggestions after each answer without blocking the main response stream.",
  },
  {
    name: "Cohere embed-multilingual-v3.0",
    role: "Embeddings",
    color: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    what: "Embedding model supporting 100+ languages. Converts text into 1024-dim vectors capturing semantic meaning.",
    why: "Embeds both document chunks (at ingestion) and queries (at retrieval) enabling cross-lingual semantic search.",
  },
  {
    name: "Cohere rerank-multilingual-v3.0",
    role: "Neural Reranking",
    color: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    what: "Cross-encoder model that re-scores retrieved candidates by reading query + document together.",
    why: "Re-ranks vector search results in context — higher precision than pure cosine similarity. Also computes faithfulness.",
  },
  {
    name: "Pinecone",
    role: "Vector Database",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    what: "Managed cloud vector database. Stores and searches high-dimensional embeddings at scale.",
    why: "Stores all document chunk vectors. Each document gets its own namespace for isolated retrieval.",
  },
  {
    name: "Supabase",
    role: "Storage & DB",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    what: "Open-source Firebase alternative — PostgreSQL + file storage + real-time subscriptions.",
    why: "Stores raw PDFs (Storage bucket), document metadata, chat history per user/document, feedback thumbs.",
  },
  {
    name: "pypdf + PyMuPDF",
    role: "PDF Processing",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    what: "pypdf: pure-Python text extraction. PyMuPDF (fitz): C-based PDF renderer for rasterising pages to images.",
    why: "pypdf handles text-based PDFs. PyMuPDF renders scanned pages for Tesseract OCR fallback.",
  },
  {
    name: "Tesseract OCR",
    role: "OCR Fallback",
    color: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    what: "Open-source OCR engine by Google. Reads text from images. Supports eng+msa+chi_sim.",
    why: "Handles scanned/image-based PDF pages that pypdf cannot extract text from.",
  },
  {
    name: "langdetect",
    role: "Language Detection",
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    what: "Python port of Google's language ID library. Probabilistic detection from short text samples.",
    why: "Fallback language detection when Malay/CJK keyword matching is inconclusive.",
  },
  {
    name: "ElevenLabs",
    role: "Text-to-Speech",
    color: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    what: "Commercial TTS API with multilingual v2 model. High-quality, natural-sounding speech.",
    why: "Reads answers back to users in Voice I/O mode. Falls back to browser speechSynthesis on quota exceed.",
  },
  {
    name: "Groq Whisper",
    role: "Speech-to-Text",
    color: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    what: "OpenAI Whisper model hosted on Groq. Transcribes audio to text at high speed.",
    why: "Converts browser MediaRecorder WebM/Opus audio into question text for the voice input feature.",
  },
  {
    name: "SlowAPI",
    role: "Rate Limiting",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    what: "Per-IP rate limiting middleware for FastAPI, built on limits + Redis-compatible backends.",
    why: "Prevents API abuse. BOOTH_MODE=true loosens limits for demo events where all visitors share one IP.",
  },
]

export const FRONTEND_STACK: StackItem[] = [
  {
    name: "Next.js 15",
    role: "React Framework",
    color: "bg-foreground/5 border-border text-foreground",
    what: "React framework with App Router, server components, file-based routing, SSR/SSG.",
    why: "Full frontend framework. Routes map to /, /workspace, /manage, /eval, /about.",
  },
  {
    name: "TypeScript",
    role: "Type Safety",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    what: "Typed JavaScript superset. Catches errors at compile time rather than runtime.",
    why: "Type safety across all components and API response shapes.",
  },
  {
    name: "Tailwind CSS",
    role: "Styling",
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    what: "Utility-first CSS framework. Style via class names, no separate CSS files.",
    why: "All styling. oklch(0.38 0.13 145) civic green as primary color.",
  },
  {
    name: "shadcn/ui",
    role: "Component Library",
    color: "bg-foreground/5 border-border text-foreground",
    what: "Copy-paste components built on Radix UI primitives. Accessible, unstyled base.",
    why: "Buttons, cards, dialogs, sliders, tabs — accessible foundations with full style control.",
  },
  {
    name: "Framer Motion",
    role: "Animations",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    what: "React animation library with declarative motion primitives and gesture support.",
    why: "Scroll-triggered fade-ins, hero parallax, card hover effects on landing page.",
  },
  {
    name: "Vercel",
    role: "Frontend Deploy",
    color: "bg-foreground/5 border-border text-foreground",
    what: "Next.js hosting platform with global edge CDN and automatic deployments from git.",
    why: "Frontend served globally. Auto-deploys on push to master.",
  },
  {
    name: "Render",
    role: "Backend Deploy",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    what: "Cloud PaaS for containerised apps. Free tier with 512MB RAM.",
    why: "Hosts the FastAPI backend. requirements.txt strips torch/transformers to fit RAM limits.",
  },
]

// ── API Endpoints ──────────────────────────────────────────────────────────

export const API_ENDPOINTS: ApiEndpoint[] = [
  { method: "POST",   path: "/api/documents/upload",              desc: "Upload + validate + ingest PDF into Pinecone" },
  { method: "GET",    path: "/api/documents/",                    desc: "List all documents with metadata" },
  { method: "DELETE", path: "/api/documents/{id}",                desc: "Delete PDF from Supabase + vectors from Pinecone" },
  { method: "POST",   path: "/api/chat/ask-stream",               desc: "Streaming Q&A via Server-Sent Events" },
  { method: "POST",   path: "/api/chat/ask",                      desc: "Buffered Q&A (non-streaming)" },
  { method: "GET",    path: "/api/chat/history",                  desc: "Load chat history for a document" },
  { method: "DELETE", path: "/api/chat/history/{doc_id}",         desc: "Clear chat history for a document" },
  { method: "POST",   path: "/api/eval/run-test-suite-stream",    desc: "Run benchmark suite with live streaming results" },
  { method: "GET",    path: "/api/eval/report",                   desc: "Get aggregated ROUGE/BLEU/latency metrics" },
  { method: "GET",    path: "/api/eval/data-quality",             desc: "Chunk quality stats per document" },
  { method: "POST",   path: "/api/voice/transcribe",              desc: "STT — WebM/Opus audio → text via Groq Whisper" },
  { method: "POST",   path: "/api/voice/tts",                     desc: "TTS — text → MP3 audio via ElevenLabs" },
  { method: "POST",   path: "/api/feedback",                      desc: "Submit thumbs up/down → persisted in Supabase" },
]

export const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-blue-500/10 text-blue-600 border-blue-500/20",
  POST:   "bg-green-500/10 text-green-600 border-green-500/20",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
}

// ── Eval Metrics ───────────────────────────────────────────────────────────

export const EVAL_METRICS: MetricItem[] = [
  {
    name: "ROUGE-1 / ROUGE-2 / ROUGE-L",
    icon: BarChart3,
    what: "Recall-Oriented Understudy for Gisting Evaluation. Measures n-gram overlap between generated and reference answers.",
    detail: "ROUGE-1 = unigrams, ROUGE-2 = bigrams, ROUGE-L = longest common subsequence. F1 score reported.",
    range: "0 – 1",
  },
  {
    name: "BLEU",
    icon: Activity,
    what: "Bilingual Evaluation Understudy. Standard machine translation metric measuring precision of n-gram matches.",
    detail: "Modified n-gram precision with brevity penalty. Originally from MT, adapted here for generation quality.",
    range: "0 – 1",
  },
  {
    name: "Faithfulness Score",
    icon: Shield,
    what: "How grounded the generated answer is in the retrieved source chunks.",
    detail: "Computed by passing the answer as a query back through Cohere reranker against the source chunks. Max relevance_score = faithfulness.",
    range: "0 – 1",
  },
  {
    name: "Confidence Score",
    icon: Target,
    what: "Composite score from vector similarity + Cohere rerank score for the top retrieved chunk.",
    detail: "final = vector_score × 0.35 + rerank_score × 0.65. Thresholds: ≥0.50 = strong, 0.12–0.49 = cautious, <0.12 = refuse.",
    range: "0 – 1",
  },
  {
    name: "Semantic Similarity",
    icon: Brain,
    what: "Cosine similarity between generated answer and ground truth using Cohere embeddings.",
    detail: "Both texts embedded with embed-multilingual-v3.0 (clustering mode). Dot product / (|a| × |b|).",
    range: "–1 – 1",
  },
  {
    name: "Flesch-Kincaid Grade",
    icon: FileText,
    what: "Readability score estimating US school grade level required to understand the answer.",
    detail: "Lower = simpler language. Target: ≤ grade 8 for accessible civic communication.",
    range: "1 – 18+",
  },
  {
    name: "Latency (p50/p95/p99)",
    icon: Zap,
    what: "End-to-end response time from question receipt to answer complete, in milliseconds.",
    detail: "Percentile breakdown: p50 = median, p95 = 95th percentile, p99 = tail latency. Tracked per question.",
    range: "ms",
  },
]

// ── Ingestion Pipeline Steps ───────────────────────────────────────────────

export const INGESTION_STEPS: PipelineStepData[] = [
  {
    n: "1",
    title: "PDF Validation",
    icon: Shield,
    items: [
      "Checks file type, encryption status, and page count (1–500 pages)",
      "Extracts text with pypdf — pages with < 50 chars flagged for OCR",
      "Rejects PDFs where > 80% of pages have no extractable text",
    ],
  },
  {
    n: "2",
    title: "Text Extraction + OCR Fallback",
    icon: FileSearch,
    items: [
      "pypdf extracts text page-by-page for text-based PDFs",
      "PyMuPDF renders low-text pages to bitmap at 2× scale",
      "Tesseract OCR reads bitmaps — supports eng + msa + chi_sim",
    ],
  },
  {
    n: "3",
    title: "Section-Aware Chunking",
    icon: Layers,
    items: [
      "Regex detects section headers: Bahagian, Seksyen, Section, numbered (1.2.3), ALLCAPS",
      "Each section becomes its own chunk — preserves document structure",
      "Long sections split at 360-word target, 45-word overlap, min 20 words/chunk",
    ],
  },
  {
    n: "4",
    title: "Cohere Embedding",
    icon: Brain,
    items: [
      "All chunks embedded in batch via Cohere embed-multilingual-v3.0",
      "Produces 1024-dim vectors per chunk — language-agnostic representation",
      "input_type = search_document (optimised for retrieval, not clustering)",
    ],
  },
  {
    n: "5",
    title: "Storage",
    icon: Database,
    items: [
      "Vectors + metadata → Pinecone under document namespace",
      "Raw PDF file → Supabase Storage bucket",
      "Document record (name, chunk count, timestamps) → Supabase PostgreSQL",
    ],
  },
]

// ── Q&A Pipeline Steps ─────────────────────────────────────────────────────

export const QA_STEPS: PipelineStepData[] = [
  {
    n: "1",
    title: "Language Detection",
    icon: Globe,
    items: [
      "Keyword matching first: Malay words (nak, boleh, saya, mohon) with word-boundary regex",
      "CJK character ratio: if > 15% of chars are CJK, classify as zh-cn",
      "langdetect library as fallback — maps 20+ dialects to en / ms / zh-cn",
    ],
  },
  {
    n: "2",
    title: "Multi-Query Augmentation",
    icon: Languages,
    items: [
      "Expands 1 question into up to 4 variants: original + paraphrase + translations",
      "Translations generated into all other supported languages",
      "Improves retrieval recall — same chunks found regardless of query language",
    ],
  },
  {
    n: "3",
    title: "Semantic Retrieval",
    icon: Search,
    items: [
      "All variants embedded in a single Cohere API call (input_type = search_query)",
      "Each variant queries Pinecone — top-k chunks per variant",
      "Results merged, deduplicated by chunk ID, sorted by composite score",
    ],
  },
  {
    n: "4",
    title: "Neural Reranking",
    icon: Target,
    items: [
      "Cohere rerank-multilingual-v3.0 re-scores candidates reading query + document together",
      "Final score = vector_score × 0.35 + rerank_score × 0.65",
      "Higher precision than cosine similarity alone — cross-encoder architecture",
    ],
  },
  {
    n: "5",
    title: "Evidence Guard",
    icon: Shield,
    items: [
      "Top chunk score ≥ 0.50 → strong evidence → standard QA prompt",
      "Score 0.12–0.49 → cautious mode → answer with caveats",
      "Score < 0.12 → hard refusal → canned message, no hallucination",
    ],
  },
  {
    n: "6",
    title: "Answer Generation",
    icon: Cpu,
    items: [
      "Context-aware prompt built in detected language (en/ms/zh-cn)",
      "Last 3 conversation turns injected for follow-up awareness",
      "Groq LLaMA 3.3 70B streams answer in 3–5 bullet points token-by-token",
    ],
  },
  {
    n: "7",
    title: "Post-Generation",
    icon: Activity,
    items: [
      "Faithfulness: answer passed back through Cohere reranker vs source chunks",
      "LLaMA 3.1 8B generates 3 follow-up question suggestions (non-blocking)",
      "Result cached (LRU, 200-entry max) — cache bypassed when chat history present",
    ],
  },
]

// ── Key Features ───────────────────────────────────────────────────────────

export const KEY_FEATURES: FeatureItem[] = [
  {
    icon: Globe,
    label: "Multilingual RAG",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    points: [
      "Cohere embed-multilingual-v3.0 handles 100+ languages in one vector space",
      "Language auto-detected per question — answer in same language",
      "Query augmented into all 3 supported languages simultaneously",
      "No re-ingestion needed when switching languages",
    ],
  },
  {
    icon: Shield,
    label: "Evidence Guard — Anti-Hallucination",
    color: "text-green-500",
    bg: "bg-green-500/10",
    points: [
      "3-tier confidence system: strong / cautious / refuse",
      "Never generates answers from outside the uploaded document",
      "Faithfulness score measures how grounded the answer is",
      "Every citation shows page number, section, and scores",
    ],
  },
  {
    icon: Mic,
    label: "Voice I/O",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    points: [
      "STT: MediaRecorder → Groq Whisper → transcribed question",
      "TTS: answer → ElevenLabs multilingual v2 → MP3",
      "Graceful fallback to browser native speechSynthesis",
      "Language reservation param ready for per-language voice",
    ],
  },
  {
    icon: BarChart3,
    label: "Evaluation Dashboard",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    points: [
      "ROUGE-1/2/L, BLEU, FK grade — all computed in-house",
      "Semantic similarity via Cohere embeddings",
      "Streaming test suite — results appear question-by-question",
      "Latency tracking: p50/p95/p99 per language",
    ],
  },
  {
    icon: Database,
    label: "Document Management",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    points: [
      "Upload: validates PDF → ingests → stores in Pinecone + Supabase",
      "Delete: removes vectors from Pinecone namespace + file from Supabase",
      "Rename: updates doc_name in all Pinecone vector metadata chunks",
      "LRU cache (200-entry) invalidated per-document on delete/rename",
    ],
  },
]
