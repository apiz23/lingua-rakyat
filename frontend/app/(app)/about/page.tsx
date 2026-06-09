"use client"

import type { ComponentType } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  FileText,
  Database,
  Cpu,
  Globe,
  Shield,
  Mic,
  BarChart3,
  Languages,
  FileSearch,
  Zap,
  Target,
  ArrowRight,
  ChevronRight,
  Server,
  Layout,
  BookOpen,
  Check,
  Clock,
  Layers,
  MessageSquare,
  Upload,
  Search,
  Brain,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_STACK = [
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

const FRONTEND_STACK = [
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

const API_ENDPOINTS = [
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

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-blue-500/10 text-blue-600 border-blue-500/20",
  POST:   "bg-green-500/10 text-green-600 border-green-500/20",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
}

const EVAL_METRICS = [
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
    icon: BookOpen,
    what: "Readability score estimating US school grade level required to understand the answer.",
    detail: "Lower = simpler language. Target: ≤ grade 8 for accessible civic communication.",
    range: "1 – 18+",
  },
  {
    name: "Latency (p50/p95/p99)",
    icon: Clock,
    what: "End-to-end response time from question receipt to answer complete, in milliseconds.",
    detail: "Percentile breakdown: p50 = median, p95 = 95th percentile, p99 = tail latency. Tracked per question.",
    range: "ms",
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionAnchor({ id }: { id: string }) {
  return <span id={id} className="-mt-20 block pt-20" aria-hidden />
}

function SectionHeader({
  icon: Icon,
  label,
  badge,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  badge?: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h2 className="font-heading text-lg font-bold text-foreground sm:text-xl">
        {label}
      </h2>
      {badge && (
        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
          {badge}
        </Badge>
      )}
    </div>
  )
}

function PipelineStep({
  n,
  title,
  items,
  icon: Icon,
  last = false,
}: {
  n: string
  title: string
  items: string[]
  icon: ComponentType<{ className?: string }>
  last?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary/20 bg-primary/8 text-sm font-bold text-primary">
          {n}
        </div>
        {!last && <div className="mt-1 w-px flex-1 bg-border/50" />}
      </div>
      <div className={cn("min-w-0 flex-1 pb-5", last && "pb-0")}>
        <div className="mb-1.5 flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary/60" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function StackCard({ name, role, color, what, why }: {
  name: string; role: string; color: string; what: string; why: string
}) {
  return (
    <Card className="border-border/60 bg-card/40 transition-all hover:border-primary/20">
      <CardHeader className="pb-2 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-sm font-semibold text-foreground">{name}</span>
          <Badge className={cn("border text-[10px] font-medium", color)}>{role}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">What: </span>{what}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-primary/80">Why: </span>{why}
        </p>
      </CardContent>
    </Card>
  )
}

function MetricCard({ name, icon: Icon, what, detail, range }: {
  name: string; icon: ComponentType<{ className?: string }>; what: string; detail: string; range: string
}) {
  return (
    <Card className="border-border/60 bg-card/40">
      <CardContent className="pb-4 pt-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-primary/60" />
            <span className="text-sm font-semibold text-foreground">{name}</span>
          </div>
          <Badge variant="outline" className="shrink-0 border-border/60 font-mono text-[10px] text-muted-foreground">
            {range}
          </Badge>
        </div>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{what}</p>
        <p className="border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <ScrollArea className="h-full">
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">

          {/* ── Page header ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="border-primary/20 bg-primary/8 text-primary">
                  Technical Reference
                </Badge>
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  v2.0.0
                </Badge>
              </div>
              <h1 className="font-heading text-xl font-black tracking-tight text-foreground sm:text-2xl">
                How Lingua Rakyat Works
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Architecture reference — ingestion pipeline, Q&amp;A system, tech stack, API, and eval metrics.
              </p>
            </div>
          </div>

          {/* ── 2-column body ── */}
          <div className="grid gap-6 xl:grid-cols-2">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-6">

              {/* Overview */}
              <section className="border border-border bg-card">
                <SectionAnchor id="overview" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={BookOpen} label="Project Overview" />
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card className="border-border/60 bg-card/40">
                      <CardContent className="pb-4 pt-4">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center bg-red-500/10">
                            <FileText className="h-3.5 w-3.5 text-red-500" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">The Problem</span>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {[
                            "Government PDFs written in legalese — not plain language",
                            "Long documents with no searchable Q&A interface",
                            "No equal access across Malay, English, and Chinese speakers",
                            "Eligibility criteria buried in paragraphs",
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/40">
                      <CardContent className="pb-4 pt-4">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center bg-primary/10">
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">The Solution</span>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {[
                            "Upload any government PDF — queryable instantly",
                            "Ask in Malay, English, or Mandarin — answer in same language",
                            "Every answer grounded in document text with page citations",
                            "Evidence guard refuses to hallucinate — shows confidence",
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="border border-primary/15 bg-primary/5 px-4 py-3">
                    <p className="text-sm text-foreground/80">
                      <span className="font-semibold text-primary">RAG in one sentence: </span>
                      Instead of an LLM guessing from training memory, Lingua Rakyat first searches the actual document for relevant passages, then passes only those passages to the LLM — so the answer is always traceable to a real source.
                    </p>
                  </div>
                </div>
              </section>

              {/* Ingestion Pipeline */}
              <section className="border border-border bg-card">
                <SectionAnchor id="ingestion" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={Upload} label="Ingestion Pipeline" badge="Phase 1" />
                  <p className="text-xs text-muted-foreground">
                    Triggered once when a PDF is uploaded. Runs offline — users can start asking questions as soon as ingestion completes.
                  </p>
                </div>
                <div className="p-5">
                  <PipelineStep n="1" title="PDF Validation" icon={Shield} items={[
                    "Checks file type, encryption status, and page count (1–500 pages)",
                    "Extracts text with pypdf — pages with < 50 chars flagged for OCR",
                    "Rejects PDFs where > 80% of pages have no extractable text",
                  ]} />
                  <PipelineStep n="2" title="Text Extraction + OCR Fallback" icon={FileSearch} items={[
                    "pypdf extracts text page-by-page for text-based PDFs",
                    "PyMuPDF renders low-text pages to bitmap at 2× scale",
                    "Tesseract OCR reads bitmaps — supports eng + msa + chi_sim",
                  ]} />
                  <PipelineStep n="3" title="Section-Aware Chunking" icon={Layers} items={[
                    "Regex detects section headers: Bahagian, Seksyen, Section, numbered (1.2.3), ALLCAPS",
                    "Each section becomes its own chunk — preserves document structure",
                    "Long sections split at 360-word target, 45-word overlap, min 20 words/chunk",
                  ]} />
                  <PipelineStep n="4" title="Cohere Embedding" icon={Brain} items={[
                    "All chunks embedded in batch via Cohere embed-multilingual-v3.0",
                    "Produces 1024-dim vectors per chunk — language-agnostic representation",
                    "input_type = search_document (optimised for retrieval, not clustering)",
                  ]} />
                  <PipelineStep n="5" title="Storage" icon={Database} last items={[
                    "Vectors + metadata → Pinecone under document namespace",
                    "Raw PDF file → Supabase Storage bucket",
                    "Document record (name, chunk count, timestamps) → Supabase PostgreSQL",
                  ]} />
                </div>
              </section>

              {/* Q&A Pipeline */}
              <section className="border border-border bg-card">
                <SectionAnchor id="qa-pipeline" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={MessageSquare} label="Q&A Pipeline" badge="Phase 2" />
                  <p className="text-xs text-muted-foreground">
                    Triggered per question. Streams tokens to the UI as they're generated — first token appears within ~600ms on a warm cache.
                  </p>
                </div>
                <div className="p-5">
                  <PipelineStep n="1" title="Language Detection" icon={Globe} items={[
                    "Keyword matching first: Malay words (nak, boleh, saya, mohon) with word-boundary regex",
                    "CJK character ratio: if > 15% of chars are CJK, classify as zh-cn",
                    "langdetect library as fallback — maps 20+ dialects to en / ms / zh-cn",
                  ]} />
                  <PipelineStep n="2" title="Multi-Query Augmentation" icon={Languages} items={[
                    "Expands 1 question into up to 4 variants: original + paraphrase + translations",
                    "Translations generated into all other supported languages",
                    "Improves retrieval recall — same chunks found regardless of query language",
                  ]} />
                  <PipelineStep n="3" title="Semantic Retrieval" icon={Search} items={[
                    "All variants embedded in a single Cohere API call (input_type = search_query)",
                    "Each variant queries Pinecone — top-k chunks per variant",
                    "Results merged, deduplicated by chunk ID, sorted by composite score",
                  ]} />
                  <PipelineStep n="4" title="Neural Reranking" icon={Target} items={[
                    "Cohere rerank-multilingual-v3.0 re-scores candidates reading query + document together",
                    "Final score = vector_score × 0.35 + rerank_score × 0.65",
                    "Higher precision than cosine similarity alone — cross-encoder architecture",
                  ]} />
                  <PipelineStep n="5" title="Evidence Guard" icon={Shield} items={[
                    "Top chunk score ≥ 0.50 → strong evidence → standard QA prompt",
                    "Score 0.12–0.49 → cautious mode → answer with caveats",
                    "Score < 0.12 → hard refusal → canned message, no hallucination",
                  ]} />
                  <PipelineStep n="6" title="Answer Generation" icon={Cpu} items={[
                    "Context-aware prompt built in detected language (en/ms/zh-cn)",
                    "Last 3 conversation turns injected for follow-up awareness",
                    "Groq LLaMA 3.3 70B streams answer in 3–5 bullet points token-by-token",
                  ]} />
                  <PipelineStep n="7" title="Post-Generation" icon={Activity} last items={[
                    "Faithfulness: answer passed back through Cohere reranker vs source chunks",
                    "LLaMA 3.1 8B generates 3 follow-up question suggestions (non-blocking)",
                    "Result cached (LRU, 200-entry max) — cache bypassed when chat history present",
                  ]} />
                </div>
              </section>

              {/* API Reference */}
              <section className="border border-border bg-card">
                <SectionAnchor id="api" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={Server} label="API Reference" />
                  <p className="text-xs text-muted-foreground">
                    All endpoints rate-limited per IP via SlowAPI. Interactive docs at{" "}
                    <code className="bg-muted/40 px-1 font-mono text-[11px] text-foreground">/docs</code> (Swagger UI).
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="w-16 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Method</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Path</th>
                        <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:table-cell">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {API_ENDPOINTS.map((ep) => (
                        <tr key={ep.path} className="hover:bg-muted/10">
                          <td className="px-4 py-2.5">
                            <Badge className={cn("border font-mono text-[10px] font-semibold", METHOD_COLORS[ep.method])}>
                              {ep.method}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <code className="font-mono text-xs text-foreground/80">{ep.path}</code>
                          </td>
                          <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">
                            {ep.desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-6">

              {/* Tech Stack */}
              <section className="border border-border bg-card">
                <SectionAnchor id="tech-stack" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={Layers} label="Tech Stack" />
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      <Server className="h-3.5 w-3.5" />
                      Backend
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {BACKEND_STACK.map((tech) => (
                        <StackCard key={tech.name} {...tech} />
                      ))}
                    </div>
                  </div>
                  <Separator className="bg-border/50" />
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      <Layout className="h-3.5 w-3.5" />
                      Frontend &amp; Deployment
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {FRONTEND_STACK.map((tech) => (
                        <StackCard key={tech.name} {...tech} />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </div>

          {/* ── Key Features + Eval Metrics side by side ── */}
          <div className="grid gap-6 xl:grid-cols-2">

            {/* Key Features */}
            <section className="border border-border bg-card">
              <SectionAnchor id="features" />
              <div className="border-b border-border px-5 py-4">
                <SectionHeader icon={Zap} label="Key Features" />
              </div>
              <div className="p-5 space-y-3">
                {[
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
                ].map((feat) => (
                  <Card key={feat.label} className="border-border/60 bg-card/40">
                    <CardContent className="pb-3 pt-3">
                      <div className="mb-2 flex items-center gap-2">
                        <div className={cn("flex h-6 w-6 items-center justify-center", feat.bg)}>
                          <feat.icon className={cn("h-3.5 w-3.5", feat.color)} />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{feat.label}</span>
                      </div>
                      <ul className="space-y-1">
                        {feat.points.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary/40" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Eval Metrics */}
            <section className="border border-border bg-card">
              <SectionAnchor id="metrics" />
              <div className="border-b border-border px-5 py-4">
                <SectionHeader icon={BarChart3} label="Evaluation Metrics" />
                <p className="text-xs text-muted-foreground">
                  All metrics computed in-house in{" "}
                  <code className="bg-muted/40 px-1 font-mono text-[11px] text-foreground">utils/evaluation.py</code>. No external eval APIs.
                </p>
              </div>
              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {EVAL_METRICS.map((m) => (
                    <MetricCard key={m.name} {...m} />
                  ))}
                </div>
              </div>
            </section>

          </div>

          {/* Footer note */}
          <div className="border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Note:</span> This page reflects the live codebase state as of the RISE 2026 submission. Backend hosted on Render (free tier, 512 MB RAM). Frontend on Vercel. Source:{" "}
            <code className="bg-muted/40 px-1 font-mono">github.com/apiz23/lingua-rakyat</code>
          </div>

        </main>
      </div>
    </ScrollArea>
  )
}
