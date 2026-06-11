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

// ── Tech Stack — English ───────────────────────────────────────────────────

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

// ── Tech Stack — Malay ─────────────────────────────────────────────────────

export const BACKEND_STACK_MS: StackItem[] = [
  {
    ...BACKEND_STACK[0],
    what: "Kerangka web Python async. Jana dokumen Swagger secara automatik di /docs. Daya pemrosesan tinggi melalui I/O async.",
    why: "Melayani semua titik akhir — sembang, dokumen, penilaian, suara — dengan dokumentasi OpenAPI automatik untuk hakim.",
  },
  {
    ...BACKEND_STACK[1],
    what: "LLM sumber terbuka Meta (70B param) berjalan pada perkakasan inferens LPU tersuai Groq. Penjanaan token yang sangat pantas.",
    why: "Menjana jawapan berasas dan bersumber dalam Bahasa Melayu, Inggeris, atau Cina daripada konteks dokumen yang diambil.",
  },
  {
    ...BACKEND_STACK[2],
    what: "Varian LLaMA yang lebih kecil dan pantas untuk tugasan kependaman rendah di mana 70B penuh berlebihan.",
    why: "Menjana cadangan soalan susulan selepas setiap jawapan tanpa menyekat aliran respons utama.",
  },
  {
    ...BACKEND_STACK[3],
    what: "Model pembenaman menyokong 100+ bahasa. Menukar teks kepada vektor 1024-dim yang menangkap makna semantik.",
    why: "Membenamkan kedua-dua chunk dokumen (semasa pengambilan) dan pertanyaan (semasa carian) membolehkan carian semantik silang bahasa.",
  },
  {
    ...BACKEND_STACK[4],
    what: "Model penyulit silang yang menilai semula calon yang diambil dengan membaca pertanyaan + dokumen bersama.",
    why: "Memeringkat semula hasil carian vektor dalam konteks — ketepatan lebih tinggi berbanding persamaan kosinus semata-mata. Juga mengira kesetiaan.",
  },
  {
    ...BACKEND_STACK[5],
    what: "Pangkalan data vektor awan yang diurus. Menyimpan dan mencari pembenaman dimensi tinggi pada skala.",
    why: "Menyimpan semua vektor chunk dokumen. Setiap dokumen mendapat ruang namanya sendiri untuk carian terpencil.",
  },
  {
    ...BACKEND_STACK[6],
    what: "Alternatif Firebase sumber terbuka — PostgreSQL + storan fail + langganan masa nyata.",
    why: "Menyimpan PDF mentah (baldi Storan), metadata dokumen, sejarah sembang setiap pengguna/dokumen, maklum balas ibu jari.",
  },
  {
    ...BACKEND_STACK[7],
    what: "pypdf: pengekstrakan teks Python semata-mata. PyMuPDF (fitz): pemapar PDF berasaskan C untuk melukis halaman kepada imej.",
    why: "pypdf mengendalikan PDF berasaskan teks. PyMuPDF melukis halaman yang diimbas untuk sandaran Tesseract OCR.",
  },
  {
    ...BACKEND_STACK[8],
    what: "Enjin OCR sumber terbuka oleh Google. Membaca teks daripada imej. Menyokong eng+msa+chi_sim.",
    why: "Mengendalikan halaman PDF yang diimbas/berasaskan imej yang pypdf tidak boleh mengekstrak teks daripadanya.",
  },
  {
    ...BACKEND_STACK[9],
    what: "Port Python pustaka ID bahasa Google. Pengesanan kebarangkalian daripada sampel teks pendek.",
    why: "Pengesanan bahasa sandaran apabila pemadanan kata kunci Melayu/CJK tidak konklusif.",
  },
  {
    ...BACKEND_STACK[10],
    what: "API TTS komersial dengan model v2 pelbagai bahasa. Pertuturan berkualiti tinggi dan semula jadi.",
    why: "Membaca jawapan semula kepada pengguna dalam mod Suara I/O. Bertukar kepada speechSynthesis pelayar apabila kuota terlampaui.",
  },
  {
    ...BACKEND_STACK[11],
    what: "Model Whisper OpenAI yang dihoskan di Groq. Transkripsi audio kepada teks pada kelajuan tinggi.",
    why: "Menukar audio WebM/Opus MediaRecorder pelayar kepada teks soalan untuk ciri input suara.",
  },
  {
    ...BACKEND_STACK[12],
    what: "Perisian tengah pengehadan kadar per-IP untuk FastAPI, dibina pada had + backend serasi Redis.",
    why: "Mencegah penyalahgunaan API. BOOTH_MODE=true melonggarkan had untuk acara demo di mana semua pelawat berkongsi satu IP.",
  },
]

export const FRONTEND_STACK_MS: StackItem[] = [
  {
    ...FRONTEND_STACK[0],
    what: "Kerangka React dengan App Router, komponen pelayan, penghalaan berasaskan fail, SSR/SSG.",
    why: "Kerangka frontend penuh. Laluan memetakan ke /, /workspace, /manage, /eval, /about.",
  },
  {
    ...FRONTEND_STACK[1],
    what: "Superset JavaScript bertaip. Menangkap ralat pada masa kompilasi berbanding masa jalan.",
    why: "Keselamatan jenis merentasi semua komponen dan bentuk respons API.",
  },
  {
    ...FRONTEND_STACK[2],
    what: "Kerangka CSS utiliti pertama. Gaya melalui nama kelas, tiada fail CSS berasingan.",
    why: "Semua penggayaan. oklch(0.38 0.13 145) hijau sivik sebagai warna utama.",
  },
  {
    ...FRONTEND_STACK[3],
    what: "Komponen salin-tampal dibina pada primitif Radix UI. Asas boleh diakses dan tidak bergaya.",
    why: "Butang, kad, dialog, gelangsar, tab — asas boleh diakses dengan kawalan gaya penuh.",
  },
  {
    ...FRONTEND_STACK[4],
    what: "Pustaka animasi React dengan primitif gerakan deklaratif dan sokongan gerak isyarat.",
    why: "Pudar masuk dicetuskan skrol, parallax wira, kesan hover kad pada halaman pendaratan.",
  },
  {
    ...FRONTEND_STACK[5],
    what: "Platform pengehosan Next.js dengan CDN tepi global dan penempatan automatik daripada git.",
    why: "Frontend dilayan secara global. Penempatan automatik apabila tolak ke master.",
  },
  {
    ...FRONTEND_STACK[6],
    what: "PaaS awan untuk aplikasi dalam bekas. Peringkat percuma dengan 512MB RAM.",
    why: "Mengehoskan backend FastAPI. requirements.txt menanggalkan torch/transformers untuk muat dalam had RAM.",
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

export const API_ENDPOINTS_MS: ApiEndpoint[] = [
  { method: "POST",   path: "/api/documents/upload",              desc: "Muat naik + sahkan + ingest PDF ke Pinecone" },
  { method: "GET",    path: "/api/documents/",                    desc: "Senaraikan semua dokumen dengan metadata" },
  { method: "DELETE", path: "/api/documents/{id}",                desc: "Padam PDF daripada Supabase + vektor daripada Pinecone" },
  { method: "POST",   path: "/api/chat/ask-stream",               desc: "S&J penstriman melalui Server-Sent Events" },
  { method: "POST",   path: "/api/chat/ask",                      desc: "S&J dibuffer (bukan penstriman)" },
  { method: "GET",    path: "/api/chat/history",                  desc: "Muatkan sejarah sembang untuk dokumen" },
  { method: "DELETE", path: "/api/chat/history/{doc_id}",         desc: "Kosongkan sejarah sembang untuk dokumen" },
  { method: "POST",   path: "/api/eval/run-test-suite-stream",    desc: "Jalankan suite penanda aras dengan keputusan penstriman langsung" },
  { method: "GET",    path: "/api/eval/report",                   desc: "Dapatkan metrik ROUGE/BLEU/kependaman yang diagregat" },
  { method: "GET",    path: "/api/eval/data-quality",             desc: "Statistik kualiti chunk setiap dokumen" },
  { method: "POST",   path: "/api/voice/transcribe",              desc: "STT — audio WebM/Opus → teks melalui Groq Whisper" },
  { method: "POST",   path: "/api/voice/tts",                     desc: "TTS — teks → audio MP3 melalui ElevenLabs" },
  { method: "POST",   path: "/api/feedback",                      desc: "Hantar ibu jari naik/turun → disimpan dalam Supabase" },
]

export const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-blue-500/10 text-blue-600 border-blue-500/20",
  POST:   "bg-green-500/10 text-green-600 border-green-500/20",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
}

// ── Eval Metrics — English ─────────────────────────────────────────────────

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

// ── Eval Metrics — Malay ───────────────────────────────────────────────────

export const EVAL_METRICS_MS: MetricItem[] = [
  {
    ...EVAL_METRICS[0],
    what: "Penaksir Ringkasan Berorientasikan Ingatan. Mengukur pertindihan n-gram antara jawapan yang dijana dan jawapan rujukan.",
    detail: "ROUGE-1 = unigram, ROUGE-2 = bigram, ROUGE-L = jujukan sepunya terpanjang. Skor F1 dilaporkan.",
  },
  {
    ...EVAL_METRICS[1],
    what: "Penaksir Penilaian Dua Bahasa. Metrik terjemahan mesin standard yang mengukur ketepatan padanan n-gram.",
    detail: "Ketepatan n-gram yang diubah suai dengan penalti keringkasan. Asalnya dari MT, diadaptasi di sini untuk kualiti penjanaan.",
  },
  {
    ...EVAL_METRICS[2],
    what: "Sejauh mana jawapan yang dijana berpunca daripada chunk sumber yang diambil semula.",
    detail: "Dikira dengan menghantar jawapan sebagai pertanyaan semula melalui pemeringkat semula Cohere berbanding chunk sumber. Max relevance_score = kesetiaan.",
  },
  {
    ...EVAL_METRICS[3],
    what: "Skor komposit daripada persamaan vektor + skor pemeringkatan semula Cohere untuk chunk teratas yang diambil.",
    detail: "final = vector_score × 0.35 + rerank_score × 0.65. Ambang: ≥0.50 = kukuh, 0.12–0.49 = berhati-hati, <0.12 = tolak.",
  },
  {
    ...EVAL_METRICS[4],
    what: "Persamaan kosinus antara jawapan yang dijana dan kebenaran asas menggunakan pembenaman Cohere.",
    detail: "Kedua-dua teks dibenamkan dengan embed-multilingual-v3.0 (mod pengelompokan). Hasil titik / (|a| × |b|).",
  },
  {
    ...EVAL_METRICS[5],
    what: "Skor kebolehbacaan yang menganggarkan tahap sekolah AS yang diperlukan untuk memahami jawapan.",
    detail: "Lebih rendah = bahasa lebih mudah. Sasaran: ≤ gred 8 untuk komunikasi sivik yang boleh diakses.",
  },
  {
    ...EVAL_METRICS[6],
    what: "Masa respons hujung ke hujung dari penerimaan soalan hingga jawapan lengkap, dalam milisaat.",
    detail: "Pecahan persentil: p50 = median, p95 = persentil ke-95, p99 = kependaman ekor. Dijejaki setiap soalan.",
  },
]

// ── Ingestion Pipeline Steps — English ────────────────────────────────────

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

// ── Ingestion Pipeline Steps — Malay ──────────────────────────────────────

export const INGESTION_STEPS_MS: PipelineStepData[] = [
  {
    n: "1",
    title: "Pengesahan PDF",
    icon: Shield,
    items: [
      "Memeriksa jenis fail, status enkripsi, dan bilangan halaman (1–500 halaman)",
      "Mengekstrak teks dengan pypdf — halaman dengan < 50 aksara ditandakan untuk OCR",
      "Menolak PDF di mana > 80% halaman tiada teks boleh diekstrak",
    ],
  },
  {
    n: "2",
    title: "Pengekstrakan Teks + Sandaran OCR",
    icon: FileSearch,
    items: [
      "pypdf mengekstrak teks halaman demi halaman untuk PDF berasaskan teks",
      "PyMuPDF memaparkan halaman berteks rendah ke bitmap pada skala 2×",
      "Tesseract OCR membaca bitmap — menyokong eng + msa + chi_sim",
    ],
  },
  {
    n: "3",
    title: "Pemotongan Peka Bahagian",
    icon: Layers,
    items: [
      "Regex mengesan pengepala bahagian: Bahagian, Seksyen, Section, bernombor (1.2.3), HURUF BESAR",
      "Setiap bahagian menjadi chunk sendiri — memelihara struktur dokumen",
      "Bahagian panjang dipotong pada sasaran 360 patah perkataan, 45 patah perkataan bertindih, min 20 patah perkataan/chunk",
    ],
  },
  {
    n: "4",
    title: "Pembenaman Cohere",
    icon: Brain,
    items: [
      "Semua chunk dibenamkan secara kumpulan melalui Cohere embed-multilingual-v3.0",
      "Menghasilkan vektor 1024-dim setiap chunk — perwakilan bebas bahasa",
      "input_type = search_document (dioptimumkan untuk carian, bukan pengelompokan)",
    ],
  },
  {
    n: "5",
    title: "Penyimpanan",
    icon: Database,
    items: [
      "Vektor + metadata → Pinecone di bawah ruang nama dokumen",
      "Fail PDF mentah → baldi Supabase Storage",
      "Rekod dokumen (nama, bilangan chunk, cap masa) → Supabase PostgreSQL",
    ],
  },
]

// ── Q&A Pipeline Steps — English ──────────────────────────────────────────

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

// ── Q&A Pipeline Steps — Malay ─────────────────────────────────────────────

export const QA_STEPS_MS: PipelineStepData[] = [
  {
    n: "1",
    title: "Pengesanan Bahasa",
    icon: Globe,
    items: [
      "Pemadanan kata kunci dahulu: perkataan Melayu (nak, boleh, saya, mohon) dengan regex sempadan kata",
      "Nisbah aksara CJK: jika > 15% aksara adalah CJK, klasifikasikan sebagai zh-cn",
      "Pustaka langdetect sebagai sandaran — memetakan 20+ dialek ke en / ms / zh-cn",
    ],
  },
  {
    n: "2",
    title: "Pengembangan Pelbagai Pertanyaan",
    icon: Languages,
    items: [
      "Mengembangkan 1 soalan kepada sehingga 4 varian: asal + parafrasa + terjemahan",
      "Terjemahan dijana ke semua bahasa yang disokong yang lain",
      "Meningkatkan recall carian — chunk yang sama dijumpai tanpa mengira bahasa pertanyaan",
    ],
  },
  {
    n: "3",
    title: "Carian Semantik",
    icon: Search,
    items: [
      "Semua varian dibenamkan dalam satu panggilan API Cohere (input_type = search_query)",
      "Setiap varian menanya Pinecone — chunk teratas-k setiap varian",
      "Keputusan digabungkan, dinyahduakan mengikut ID chunk, diisih mengikut skor komposit",
    ],
  },
  {
    n: "4",
    title: "Pemeringkatan Semula Neural",
    icon: Target,
    items: [
      "Cohere rerank-multilingual-v3.0 menilai semula calon dengan membaca pertanyaan + dokumen bersama",
      "Skor akhir = vector_score × 0.35 + rerank_score × 0.65",
      "Ketepatan lebih tinggi berbanding persamaan kosinus sahaja — seni bina penyulit silang",
    ],
  },
  {
    n: "5",
    title: "Penjaga Bukti",
    icon: Shield,
    items: [
      "Skor chunk teratas ≥ 0.50 → bukti kukuh → prompt QA standard",
      "Skor 0.12–0.49 → mod berhati-hati → jawapan dengan amaran",
      "Skor < 0.12 → penolakan keras → mesej tetap, tiada halusinasi",
    ],
  },
  {
    n: "6",
    title: "Penjanaan Jawapan",
    icon: Cpu,
    items: [
      "Prompt sedar konteks dibina dalam bahasa yang dikesan (en/ms/zh-cn)",
      "3 giliran perbualan terakhir disuntik untuk kesedaran soalan susulan",
      "Groq LLaMA 3.3 70B mengalirkan jawapan dalam 3–5 titik peluru token demi token",
    ],
  },
  {
    n: "7",
    title: "Pasca-Penjanaan",
    icon: Activity,
    items: [
      "Kesetiaan: jawapan dihantar semula melalui pemeringkat semula Cohere berbanding chunk sumber",
      "LLaMA 3.1 8B menjana 3 cadangan soalan susulan (tidak menyekat)",
      "Keputusan dicache (LRU, maksimum 200 entri) — cache dipintas apabila sejarah sembang hadir",
    ],
  },
]

// ── Key Features — English ─────────────────────────────────────────────────

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

// ── Key Features — Malay ───────────────────────────────────────────────────

export const KEY_FEATURES_MS: FeatureItem[] = [
  {
    ...KEY_FEATURES[0],
    label: "RAG Pelbagai Bahasa",
    points: [
      "Cohere embed-multilingual-v3.0 mengendalikan 100+ bahasa dalam satu ruang vektor",
      "Bahasa dikesan automatik setiap soalan — jawapan dalam bahasa yang sama",
      "Pertanyaan diperluaskan kepada semua 3 bahasa yang disokong serentak",
      "Tiada pengambilan semula diperlukan apabila bertukar bahasa",
    ],
  },
  {
    ...KEY_FEATURES[1],
    label: "Penjaga Bukti — Anti-Halusinasi",
    points: [
      "Sistem keyakinan 3 peringkat: kukuh / berhati-hati / tolak",
      "Tidak pernah menjana jawapan daripada luar dokumen yang dimuat naik",
      "Skor kesetiaan mengukur sejauh mana jawapan berpunca",
      "Setiap petikan menunjukkan nombor halaman, bahagian, dan skor",
    ],
  },
  {
    ...KEY_FEATURES[2],
    label: "Suara I/O",
    points: [
      "STT: MediaRecorder → Groq Whisper → soalan yang ditranskripsi",
      "TTS: jawapan → ElevenLabs multilingual v2 → MP3",
      "Sandaran anggun kepada speechSynthesis pelayar asli",
      "Parameter tempahan bahasa sedia untuk suara setiap bahasa",
    ],
  },
  {
    ...KEY_FEATURES[3],
    label: "Papan Pemuka Penilaian",
    points: [
      "ROUGE-1/2/L, BLEU, gred FK — semua dikira secara dalaman",
      "Persamaan semantik melalui pembenaman Cohere",
      "Suite ujian penstriman — keputusan muncul soalan demi soalan",
      "Penjejakan kependaman: p50/p95/p99 setiap bahasa",
    ],
  },
  {
    ...KEY_FEATURES[4],
    label: "Pengurusan Dokumen",
    points: [
      "Muat naik: sahkan PDF → ingest → simpan dalam Pinecone + Supabase",
      "Padam: alih keluar vektor daripada ruang nama Pinecone + fail daripada Supabase",
      "Namakan semula: kemas kini doc_name dalam semua metadata vektor Pinecone",
      "Cache LRU (200 entri) tidak sah setiap dokumen semasa padam/namakan semula",
    ],
  },
]
