# About Page — Presentation Slides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen Canva-style slideshow to the About page, accessible via a "Present" button, with 6 slides covering all major sections, left/right nav, autoplay at 5s, and keyboard controls.

**Architecture:** Extract all about-page data constants to `data.ts` so both `page.tsx` and the new `presentation-slides.tsx` component can import them without duplication. The slide component renders via `createPortal` to `document.body` for true full-screen overlay above the app shell.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react, shadcn/ui Button

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/app/(app)/about/data.ts` | All data constants (stacks, pipelines, features, metrics) |
| Modify | `frontend/app/(app)/about/page.tsx` | Import from data.ts, add "Present" button + modal state |
| Create | `frontend/components/about/presentation-slides.tsx` | Full slideshow component (portal, 6 slides, controls) |

---

## Task 1: Create `data.ts` — extract all constants

**Files:**
- Create: `frontend/app/(app)/about/data.ts`

- [ ] **Step 1: Create the file with all types and exported constants**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles — run from `frontend/`**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors referencing `data.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(app\)/about/data.ts
git commit -m "refactor(about): extract page data constants to data.ts"
```

---

## Task 2: Update `page.tsx` — import from data.ts, add Present button

**Files:**
- Modify: `frontend/app/(app)/about/page.tsx`

- [ ] **Step 1: Replace the inline constants with imports**

At the top of `page.tsx`, replace the entire `// ─── Constants ───` block (lines 38–256) with:

```typescript
import {
  BACKEND_STACK,
  FRONTEND_STACK,
  API_ENDPOINTS,
  METHOD_COLORS,
  EVAL_METRICS,
  INGESTION_STEPS,
  QA_STEPS,
  KEY_FEATURES,
} from "./data"
```

Keep all icon imports (they're still used by the sub-components in this file).

- [ ] **Step 2: Remove the now-redundant lucide icon imports that only data.ts uses**

In the existing import from `"lucide-react"` at the top of `page.tsx`, remove these icons that are now only used in `data.ts` (not in the JSX of `page.tsx` itself):
- `FileSearch` — only used in INGESTION_STEPS
- `Languages` — only used in QA_STEPS
- `Search` — only used in QA_STEPS

Keep: `FileText, Database, Cpu, Globe, Shield, Mic, BarChart3, Languages, FileSearch, Zap, Target, ArrowRight, ChevronRight, Server, Layout, BookOpen, Check, Clock, Layers, MessageSquare, Upload, Search, Brain, Activity` — check each one is still referenced in page.tsx JSX before removing.

> **Note:** It is safe to leave all icon imports in place even if unused — TypeScript won't error on unused imports, and tree-shaking removes them at build time. Skip this step if unsure which icons page.tsx JSX still uses directly.

- [ ] **Step 3: Add `useState` import and `PresentationSlides` import**

Add to the top of the file (after existing imports):

```typescript
import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PresentationSlides } from "@/components/about/presentation-slides"
```

- [ ] **Step 4: Add modal state inside `AboutPage` component**

At the top of the `AboutPage` function body, before the `return`:

```typescript
const [presentOpen, setPresentOpen] = useState(false)
```

- [ ] **Step 5: Add the Present button to the page header**

Find the page header `<div className="flex items-start justify-between gap-4">` (around line 384 in original, now shifted). Replace the existing inner `<div>` (which only has badges + h1 + p) with:

```tsx
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
  <Button
    variant="outline"
    size="sm"
    onClick={() => setPresentOpen(true)}
    className="shrink-0 gap-2 border-primary/30 text-primary hover:bg-primary/5"
  >
    <Play className="h-3.5 w-3.5" />
    Present
  </Button>
</div>
```

- [ ] **Step 6: Add `<PresentationSlides>` just before the closing `</ScrollArea>`**

Find the closing `</ScrollArea>` at the bottom of the return. Just before it, add:

```tsx
<PresentationSlides open={presentOpen} onClose={() => setPresentOpen(false)} />
```

- [ ] **Step 7: Update `PipelineStep` usages in page.tsx to use data from imports**

The `PipelineStep` components in page.tsx currently receive inline props. Now that `INGESTION_STEPS` and `QA_STEPS` exist in data.ts, replace the inline `<PipelineStep ... />` calls in the Ingestion Pipeline section with a map:

```tsx
{/* Ingestion Pipeline section body — replace the 5 inline PipelineStep calls with: */}
<div className="p-5">
  {INGESTION_STEPS.map((step, i) => (
    <PipelineStep
      key={step.n}
      n={step.n}
      title={step.title}
      icon={step.icon}
      items={step.items}
      last={i === INGESTION_STEPS.length - 1}
    />
  ))}
</div>
```

```tsx
{/* Q&A Pipeline section body — replace the 7 inline PipelineStep calls with: */}
<div className="p-5">
  {QA_STEPS.map((step, i) => (
    <PipelineStep
      key={step.n}
      n={step.n}
      title={step.title}
      icon={step.icon}
      items={step.items}
      last={i === QA_STEPS.length - 1}
    />
  ))}
</div>
```

Also replace the Key Features inline `.map()` array with `KEY_FEATURES`:

```tsx
{/* Key Features section — replace the inline array with KEY_FEATURES: */}
<div className="p-5 space-y-3">
  {KEY_FEATURES.map((feat) => (
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
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add frontend/app/\(app\)/about/page.tsx
git commit -m "feat(about): add Present button and wire PresentationSlides modal"
```

---

## Task 3: Create `presentation-slides.tsx`

**Files:**
- Create: `frontend/components/about/presentation-slides.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p frontend/components/about
```

- [ ] **Step 2: Write the full component**

```tsx
// frontend/components/about/presentation-slides.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Play, Pause, X, ChevronLeft, ChevronRight,
  ArrowRight, Check, FileText,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  BACKEND_STACK,
  FRONTEND_STACK,
  EVAL_METRICS,
  KEY_FEATURES,
  INGESTION_STEPS,
  QA_STEPS,
} from "@/app/(app)/about/data"

// ── Constants ──────────────────────────────────────────────────────────────

const TOTAL = 6
const SLIDE_LABELS = [
  "Overview",
  "Ingestion Pipeline",
  "Q&A Pipeline",
  "Tech Stack",
  "Key Features",
  "Eval Metrics",
]

// ── Slide content components ───────────────────────────────────────────────

function SlideOverview() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-8">
      <div className="grid flex-1 gap-4 sm:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center bg-red-500/10">
              <FileText className="h-3.5 w-3.5 text-red-500" />
            </div>
            <span className="text-sm font-semibold text-foreground">The Problem</span>
          </div>
          <ul className="space-y-2">
            {[
              "Government PDFs written in legalese — not plain language",
              "Long documents with no searchable Q&A interface",
              "No equal access across Malay, English, and Chinese speakers",
              "Eligibility criteria buried in paragraphs",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-primary/25 bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center bg-primary/10">
              <Check className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">The Solution</span>
          </div>
          <ul className="space-y-2">
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
        </div>
      </div>

      <div className="border border-primary/15 bg-primary/5 px-5 py-4">
        <p className="text-sm text-foreground/80">
          <span className="font-semibold text-primary">RAG in one sentence: </span>
          Instead of an LLM guessing from training memory, Lingua Rakyat first searches the actual
          document for relevant passages, then passes only those passages to the LLM — so the answer
          is always traceable to a real source.
        </p>
      </div>
    </div>
  )
}

function SlidePipeline({
  steps,
}: {
  steps: typeof INGESTION_STEPS
}) {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="space-y-0">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isLast = i === steps.length - 1
          return (
            <div key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-primary/20 bg-primary/8 text-xs font-bold text-primary">
                  {step.n}
                </div>
                {!isLast && <div className="mt-0.5 w-px flex-1 bg-border/50" />}
              </div>
              <div className={cn("min-w-0 flex-1 pb-4", isLast && "pb-0")}>
                <div className="mb-1 flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                  <span className="text-sm font-semibold text-foreground">{step.title}</span>
                </div>
                <ul className="space-y-0.5">
                  {step.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary/40" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlideTechStack() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Backend
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BACKEND_STACK.map((tech) => (
              <div key={tech.name} className="border border-border/60 bg-card/40 px-3 py-2">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">{tech.name}</span>
                  <Badge className={cn("border text-[10px] font-medium", tech.color)}>
                    {tech.role}
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  <span className="font-medium text-primary/80">Why: </span>{tech.why}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Frontend &amp; Deployment
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FRONTEND_STACK.map((tech) => (
              <div key={tech.name} className="border border-border/60 bg-card/40 px-3 py-2">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">{tech.name}</span>
                  <Badge className={cn("border text-[10px] font-medium", tech.color)}>
                    {tech.role}
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  <span className="font-medium text-primary/80">Why: </span>{tech.why}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideFeatures() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {KEY_FEATURES.map((feat) => {
          const Icon = feat.icon
          return (
            <div key={feat.label} className="border border-border/60 bg-card/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className={cn("flex h-6 w-6 items-center justify-center", feat.bg)}>
                  <Icon className={cn("h-3.5 w-3.5", feat.color)} />
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
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlideMetrics() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {EVAL_METRICS.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.name} className="border border-border/60 bg-card/40 p-4">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary/60" />
                  <span className="text-sm font-semibold text-foreground">{m.name}</span>
                </div>
                <Badge variant="outline" className="shrink-0 border-border/60 font-mono text-[10px] text-muted-foreground">
                  {m.range}
                </Badge>
              </div>
              <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground">{m.what}</p>
              <p className="border border-border/40 bg-muted/20 px-2 py-1 text-[11px] leading-relaxed text-muted-foreground">
                {m.detail}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Slide registry ─────────────────────────────────────────────────────────

const SLIDES = [
  <SlideOverview key="overview" />,
  <SlidePipeline key="ingestion" steps={INGESTION_STEPS} />,
  <SlidePipeline key="qa" steps={QA_STEPS} />,
  <SlideTechStack key="tech" />,
  <SlideFeatures key="features" />,
  <SlideMetrics key="metrics" />,
]

// ── Main component ─────────────────────────────────────────────────────────

interface PresentationSlidesProps {
  open: boolean
  onClose: () => void
}

export function PresentationSlides({ open, onClose }: PresentationSlidesProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setCurrentSlide(0)
      setIsPlaying(true)
    }
  }, [open])

  const goTo = useCallback((idx: number) => {
    setCurrentSlide(Math.max(0, Math.min(TOTAL - 1, idx)))
  }, [])

  // Autoplay — restarts whenever currentSlide or isPlaying changes
  useEffect(() => {
    if (!open || !isPlaying) return
    const id = setInterval(() => {
      setCurrentSlide((c) => {
        if (c >= TOTAL - 1) {
          setIsPlaying(false)
          return c
        }
        return c + 1
      })
    }, 5000)
    return () => clearInterval(id)
  }, [open, isPlaying, currentSlide])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          setCurrentSlide((c) => Math.max(0, c - 1))
          setIsPlaying(false)
          break
        case "ArrowRight":
          setCurrentSlide((c) => Math.min(TOTAL - 1, c + 1))
          setIsPlaying(false)
          break
        case " ":
          e.preventDefault()
          setIsPlaying((p) => !p)
          break
        case "Escape":
          onClose()
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col gap-3 bg-black/92 p-3">

      {/* Top bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Lingua Rakyat — Presentation
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className={cn(
              "flex h-8 w-8 items-center justify-center border text-xs transition-colors",
              isPlaying
                ? "border-primary bg-primary text-white"
                : "border-white/20 bg-white/8 text-white/60 hover:bg-white/12",
            )}
          >
            {isPlaying
              ? <Pause className="h-3.5 w-3.5" />
              : <Play className="h-3.5 w-3.5" />
            }
          </button>
          <span className="text-[11px] text-white/35">5s</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-white/20 bg-white/8 text-white/60 hover:bg-white/12"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Slide surface */}
      <div className="flex flex-1 overflow-hidden bg-background">
        {/* Sidebar */}
        <div className="flex w-[240px] shrink-0 flex-col justify-between border-r border-border bg-card p-7 overflow-hidden">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
              {String(currentSlide + 1).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
            </div>
            <div className="mb-4 h-0.5 w-8 bg-primary" />
            <h2 className="font-heading text-xl font-black leading-tight text-foreground">
              {SLIDE_LABELS[currentSlide]}
            </h2>
          </div>
          <nav className="flex flex-col gap-2.5">
            {SLIDE_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => { goTo(i); setIsPlaying(false) }}
                className={cn(
                  "flex items-center gap-2.5 text-left transition-opacity",
                  i === currentSlide ? "opacity-100" : "opacity-35 hover:opacity-65",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full transition-all",
                    i === currentSlide ? "scale-125 bg-primary" : "bg-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px]",
                    i === currentSlide
                      ? "font-semibold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content area */}
        <div className="min-w-0 flex-1 overflow-hidden">
          {SLIDES[currentSlide]}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => { setCurrentSlide((c) => Math.max(0, c - 1)); setIsPlaying(false) }}
          disabled={currentSlide === 0}
          className="flex h-10 w-10 items-center justify-center border border-white/20 bg-white/8 text-white/70 transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="relative h-0.5 w-64 overflow-hidden bg-white/12">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / TOTAL) * 100}%` }}
          />
        </div>

        <span className="min-w-[44px] text-center text-[11px] tabular-nums text-white/35">
          {currentSlide + 1} / {TOTAL}
        </span>

        <button
          onClick={() => { setCurrentSlide((c) => Math.min(TOTAL - 1, c + 1)); setIsPlaying(false) }}
          disabled={currentSlide === TOTAL - 1}
          className="flex h-10 w-10 items-center justify-center border border-white/20 bg-white/8 text-white/70 transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

    </div>,
    document.body,
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Start dev server and manually verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/about` (or whatever port the app uses — check the terminal output).

Manual verification checklist:
- [ ] "Present" button appears in the top-right of the About page header
- [ ] Clicking "Present" opens the full-screen overlay
- [ ] Slide 1 (Overview) shows — left sidebar has "01 / 06", "Overview" label, all 6 dots in the nav
- [ ] Problem card + Solution card + RAG callout visible on right
- [ ] Clicking → advances to Slide 2 (Ingestion Pipeline) with 5 steps
- [ ] Slide 3 (Q&A Pipeline) shows 7 steps
- [ ] Slide 4 (Tech Stack) shows backend + frontend grids
- [ ] Slide 5 (Key Features) shows 5 feature cards
- [ ] Slide 6 (Eval Metrics) shows 7 metric cards
- [ ] ← arrow disabled on slide 1, → arrow disabled on slide 6
- [ ] Progress bar fills proportionally as you advance
- [ ] Sidebar nav dots: active slide is bright, others dim — clicking a dot jumps to that slide
- [ ] Autoplay (▶ button is green/filled on open): slides auto-advance every ~5s
- [ ] Autoplay stops at slide 6
- [ ] Clicking ⏸ pauses autoplay (button changes to unfilled ▶)
- [ ] `ArrowLeft` / `ArrowRight` keys navigate + pause autoplay
- [ ] `Space` key toggles autoplay
- [ ] `Escape` key closes the overlay
- [ ] ✕ button closes the overlay
- [ ] About page renders identically with data now coming from data.ts imports

- [ ] **Step 5: Commit**

```bash
git add frontend/components/about/presentation-slides.tsx
git commit -m "feat(about): add full-screen presentation slideshow component"
```

---

## Self-Review

**Spec coverage:**
- ✅ Present button on About page header
- ✅ Full-screen overlay with dark outer shell + white slide using CSS vars
- ✅ Two-column layout: sidebar (number, title, nav dots) + content
- ✅ 6 slides: Overview, Ingestion Pipeline, Q&A Pipeline, Tech Stack, Features, Eval Metrics
- ✅ Top bar: autoplay toggle + 5s label + close
- ✅ Bottom nav: ← progress bar counter →, arrows disabled at ends
- ✅ Keyboard: ArrowLeft, ArrowRight, Space, Escape
- ✅ Autoplay 5s, stops at last slide, resets timer on nav
- ✅ Data extracted to data.ts, no duplication
- ✅ Portal to document.body

**Placeholder scan:** No TBD/TODO in any step. All code blocks are complete.

**Type consistency:**
- `PipelineStepData.icon` used as `const Icon = step.icon` then `<Icon ... />` — correct pattern
- `FeatureItem.icon` same pattern — correct
- `SLIDES` array is defined at module level using JSX — these are valid React elements
- `goTo` / `setCurrentSlide` / `setIsPlaying` all use consistent naming throughout
