// src/lib/api.ts
// All API calls to the FastAPI backend go through this file

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ── Types ──────────────────────────────────────────────────────────────────

export type Document = {
  id: string
  name: string
  size_bytes: number
  chunk_count: number
  status: "processing" | "ready" | "error"
  uploaded_at: string
  error_message?: string
  storage_path?: string
  public_url?: string
}

export type UploadDocumentResponse = {
  success: boolean
  document: Document
  message: string
}

export type SourceChunk = {
  text: string
  document_id: string
  score: number
}

export type AskResponse = {
  answer: string
  sources: SourceChunk[]
  language: string
  question: string
  timestamp: string
  confidence: number
  latency_ms: number
  model_used?: string
  retrieval_mode?: "single_query" | "augmented"
  query_variants_used?: string[]
  top_query_variant?: string
  sufficient_evidence?: boolean
}

export type ChatHistoryMessage = {
  id: string
  user_id?: string
  session_id: string
  document_id: string
  question: string
  answer: string
  language: string
  sources: SourceChunk[]
  timestamp: string
  confidence: number
  latency_ms: number
  model_used?: string
  sufficient_evidence?: boolean
}

// ── Evaluation Types ───────────────────────────────────────────────────────

export type EvalReport = {
  status: string
  generated_at: string
  total_queries: number
  latency: {
    p50_ms: number
    p95_ms: number
    p99_ms: number
    avg_ms: number
  }
  retrieval: {
    avg_confidence: number
    pct_above_threshold: number
  }
  readability: {
    avg_fk_grade: number
    pct_simple_language: number
    target_grade: number
    note: string
  }
  per_language: Record<
    string,
    {
      queries: number
      avg_confidence: number
      avg_latency_ms: number
      avg_fk_grade: number
    }
  >
  generation_quality?: {
    samples_with_ground_truth: number
    avg_rouge1_f1: number
    avg_rouge2_f1: number
    avg_rougeL_f1: number
    avg_bleu: number
    exact_match_rate: number
  }
}

export type TestSuiteResult = {
  status: string
  aggregate: {
    cases_run: number
    cases_failed: number
    avg_rouge1_f1: number
    avg_rouge2_f1: number
    avg_rougeL_f1: number
    avg_bleu: number
    avg_fk_grade: number
    avg_confidence: number
    avg_latency_ms: number
    readability_note: string
  }
  results: Array<{
    case_index: number
    language: string
    category?: string
    question: string
    answer: string
    ground_truth: string
    scores: {
      rouge1_f1: number
      rouge2_f1: number
      rougeL_f1: number
      bleu: number
      fk_grade: number
      confidence: number
      latency_ms: number
    }
  }>
  errors: Array<{ case_index: number; question: string; error: string }>
}

export type SimplifyDemo = {
  description: string
  examples: Array<{
    original: string
    simplified: string
    language: string
  }>
}

export type AugmentResult = {
  original: string
  source_lang: string
  variants: Record<string, string>
  variant_count: number
}

// ── Rate-limit aware fetch ─────────────────────────────────────────────────
async function apiFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") ?? "60"
    throw new Error(
      `Too many requests — please wait ${retryAfter} seconds and try again.`
    )
  }
  return res
}

// ── Document API ───────────────────────────────────────────────────────────

export async function uploadDocument(file: File): Promise<UploadDocumentResponse> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await apiFetch(`${API_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Upload failed")
  }
  return res.json()
}

export async function listDocuments(): Promise<Document[]> {
  const res = await apiFetch(`${API_URL}/api/documents/`)
  if (!res.ok) throw new Error("Failed to fetch documents")
  return res.json()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/documents/${documentId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete document")
}

// ── FIX: Re-sync chunk counts from Pinecone ───────────────────────────────
// Fixes existing documents that show chunk_count=0 because they were
// uploaded before the backend fix. Queries Pinecone for real vector counts.
export async function refreshChunkCounts(): Promise<{
  updated: number
  total: number
  message: string
}> {
  const res = await apiFetch(`${API_URL}/api/documents/refresh-chunks`, {
    method: "POST",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Refresh failed" }))
    throw new Error(err.detail || "Refresh failed")
  }
  return res.json()
}

// ── Chat API ───────────────────────────────────────────────────────────────

export async function askQuestion(
  userId: string,
  documentId: string,
  documentName: string,
  sessionId: string,
  question: string,
  modelOverride: string = "",
  enableQueryAugmentation: boolean = true
): Promise<AskResponse> {
  const res = await apiFetch(`${API_URL}/api/chat/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      document_id: documentId,
      document_name: documentName,
      session_id: sessionId,
      question: question,
      model_override: modelOverride,
      enable_query_augmentation: enableQueryAugmentation,
    }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Failed to get answer")
  }
  return res.json()
}

export async function getChatHistory(params: {
  userId: string
  documentId?: string
  sessionId?: string
}): Promise<ChatHistoryMessage[]> {
  const search = new URLSearchParams()
  search.set("user_id", params.userId)
  if (params.documentId) search.set("document_id", params.documentId)
  if (params.sessionId) search.set("session_id", params.sessionId)

  const res = await apiFetch(`${API_URL}/api/chat/history?${search.toString()}`)
  if (!res.ok) throw new Error("Failed to fetch chat history")
  return res.json()
}

export async function clearChatHistory(params: {
  documentId: string
  userId?: string
  sessionId?: string
}): Promise<{ success: boolean; message: string; deleted_rows: number }> {
  const search = new URLSearchParams()
  if (params.userId) search.set("user_id", params.userId)
  if (params.sessionId) search.set("session_id", params.sessionId)

  const suffix = search.toString() ? `?${search.toString()}` : ""
  const res = await apiFetch(
    `${API_URL}/api/chat/history/${params.documentId}${suffix}`,
    { method: "DELETE" }
  )
  if (!res.ok) throw new Error("Failed to clear chat history")
  return res.json()
}

// ── Evaluation API ─────────────────────────────────────────────────────────

export async function getEvalReport(): Promise<EvalReport> {
  const res = await apiFetch(`${API_URL}/api/eval/report`)
  if (!res.ok) throw new Error("Failed to fetch evaluation report")
  return res.json()
}

export async function runTestSuite(
  documentId: string,
  docName: string = "",
  modelOverride: string = ""
): Promise<TestSuiteResult> {
  const res = await apiFetch(`${API_URL}/api/eval/run-test-suite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      doc_name: docName,
      model_override: modelOverride,
    }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Test suite failed")
  }
  return res.json()
}

export async function getSimplifyDemo(): Promise<SimplifyDemo> {
  const res = await apiFetch(`${API_URL}/api/eval/simplify-demo`)
  if (!res.ok) throw new Error("Failed to fetch simplify demo")
  return res.json()
}

export async function augmentQuery(
  query: string,
  sourceLang: string = "en"
): Promise<AugmentResult> {
  const res = await apiFetch(`${API_URL}/api/eval/augment-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, source_lang: sourceLang }),
  })
  if (!res.ok) throw new Error("Failed to augment query")
  return res.json()
}

export async function clearEvalRecords(): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/eval/clear`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to clear eval records")
}

// ── Streaming test suite ───────────────────────────────────────────────────

export type StreamProgressEvent = {
  type: "progress"
  index: number
  total: number
  result: TestSuiteResult["results"][0]
}
export type StreamAggregateEvent = {
  type: "aggregate"
  aggregate: TestSuiteResult["aggregate"]
  results: TestSuiteResult["results"]
  errors: TestSuiteResult["errors"]
}
export type StreamErrorEvent = { type: "error"; index: number; error: string }
export type StreamDoneEvent = { type: "done" }
export type StreamSkippedEvent = {
  type: "skipped"
  reason: string
  detected_category: string | null
}
export type StreamCategoryEvent = {
  type: "category"
  category: string
  total: number
}
export type StreamEvent =
  | StreamProgressEvent
  | StreamAggregateEvent
  | StreamErrorEvent
  | StreamDoneEvent
  | StreamSkippedEvent
  | StreamCategoryEvent

export async function runTestSuiteStream(
  documentId: string,
  docName: string = "",
  modelOverride: string = "",
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_URL}/api/eval/run-test-suite-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      doc_name: docName,
      model_override: modelOverride,
    }),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ detail: "Stream failed" }))
    throw new Error(err.detail || "Stream failed")
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      try {
        const event: StreamEvent = JSON.parse(line.slice(6))
        onEvent(event)
      } catch {}
    }
  }
}

// ── Available Groq models ──────────────────────────────────────────────────
// rpm = requests/min, rpd = requests/day, tpm = tokens/min, tpd = tokens/day
export const GROQ_MODELS = [
  {
    id: "groq/compound",
    label: "Groq Compound",
    tag: "⭐ Primary · 70K TPM · Unlimited",
    recommended: true,
    tier: 1,
  },
  {
    id: "groq/compound-mini",
    label: "Groq Compound Mini",
    tag: "⚡ Fast · 70K TPM · Unlimited",
    rpm: 30,
    rpd: "250",
    tpm: "70K",
    tpd: "No limit",
    recommended: false,
    tier: 2,
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    tag: "Chat default · 30K TPM · 500K/day",
    rpm: 30,
    rpd: "1K",
    tpm: "30K",
    tpd: "500K",
    recommended: true,
  },
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    tag: "Best quality · 12K TPM · 100K/day",
    rpm: 30,
    rpd: "1K",
    tpm: "12K",
    tpd: "100K",
    recommended: false,
  },
  {
    id: "qwen/qwen3-32b",
    label: "Qwen3 32B",
    tag: "Eval default · 6K TPM · 500K/day",
    rpm: 60,
    rpd: "1K",
    tpm: "6K",
    tpd: "500K",
    recommended: false,
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    tag: "Fastest · 6K TPM · 500K/day",
    rpm: 30,
    rpd: "14.4K",
    tpm: "6K",
    tpd: "500K",
    recommended: false,
  },
]
