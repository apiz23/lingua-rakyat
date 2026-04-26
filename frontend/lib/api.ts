// src/lib/api.ts
// All API calls to the FastAPI backend go through this file

import {
  cacheAnswerSources,
  cacheDocuments,
  cacheHistory,
  getCachedDocuments,
  getCachedHistory,
  offlineSearchAnswer,
} from "@/lib/offline-cache"

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
  doc_name?: string
  page_start?: number | null
  page_end?: number | null
  section_title?: string
  vector_score?: number
  rerank_score?: number
  confidence_label?: "high" | "medium" | "low"
}

export type AskResponse = {
  answer: string
  sources: SourceChunk[]
  language: string
  question: string
  timestamp: string
  confidence: number
  confidence_label?: "high" | "medium" | "low"
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
  confidence_label?: "high" | "medium" | "low"
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

export async function verifyUploadToken(token: string): Promise<void> {
  const params = new URLSearchParams({ token })
  const res = await apiFetch(
    `${API_URL}/api/documents/verify-token?${params}`,
    {
      method: "POST",
    }
  )
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Invalid token")
  }
}

export async function uploadDocument(
  file: File,
  uploadToken: string
): Promise<UploadDocumentResponse> {
  const formData = new FormData()
  formData.append("file", file)
  const params = new URLSearchParams({ upload_token: uploadToken })
  const res = await apiFetch(`${API_URL}/api/documents/upload?${params}`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Upload failed")
  }
  const result = await res.json()
  cacheDocuments([result.document, ...getCachedDocuments()])
  return result
}

export async function listDocuments(): Promise<Document[]> {
  try {
    const res = await apiFetch(`${API_URL}/api/documents/`)
    if (!res.ok) throw new Error("Failed to fetch documents")
    const documents = await res.json()
    cacheDocuments(documents)
    return documents
  } catch (error) {
    const cached = getCachedDocuments()
    if (cached.length) return cached
    throw error
  }
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/documents/${documentId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete document")
}

export async function renameDocument(
  documentId: string,
  name: string,
  uploadToken: string
): Promise<Document> {
  const res = await apiFetch(`${API_URL}/api/documents/${documentId}/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, upload_token: uploadToken }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Rename failed" }))
    throw new Error(error.detail || "Rename failed")
  }
  const updated = await res.json()
  cacheDocuments(
    getCachedDocuments().map((doc) => (doc.id === updated.id ? updated : doc))
  )
  return updated
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

  try {
    const res = await apiFetch(
      `${API_URL}/api/chat/history?${search.toString()}`
    )
    if (!res.ok) throw new Error("Failed to fetch chat history")
    const messages = await res.json()
    cacheHistory(messages)
    return messages
  } catch (error) {
    const cached = getCachedHistory({
      userId: params.userId,
      documentId: params.documentId,
      sessionId: params.sessionId,
    })
    if (cached.length) return cached
    throw error
  }
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

// ── Streaming chat ─────────────────────────────────────────────────────────

export type ChatStreamEvent =
  | { type: "start" }
  | {
      type: "retrieval"
      language: string
      retrieval_mode: string
      query_variants_used: string[]
      top_query_variant: string
      sufficient_evidence?: boolean
    }
  | { type: "token"; text: string }
  | { type: "sources"; sources: SourceChunk[] }
  | {
      type: "complete"
      answer: string
      language: string
      sources: SourceChunk[]
      confidence: number
      confidence_label?: "high" | "medium" | "low"
      latency_ms: number
      model_used: string
      sufficient_evidence: boolean
      cached: boolean
      retrieval_mode?: string
      query_variants_used?: string[]
      top_query_variant?: string
    }
  | { type: "error"; detail: string }

export async function askQuestionStream(
  userId: string,
  documentId: string,
  documentName: string,
  sessionId: string,
  question: string,
  modelOverride: string = "",
  enableQueryAugmentation: boolean = true,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const runOfflineFallback = () => {
    const startedAt = Date.now()
    const result = offlineSearchAnswer({
      question,
      documentId,
      documentName,
    })
    const complete = {
      type: "complete" as const,
      answer: result.answer,
      language: "ms",
      sources: result.sources,
      confidence: result.confidence,
      confidence_label: result.confidence_label,
      latency_ms: Date.now() - startedAt,
      model_used: "offline-cache",
      sufficient_evidence: result.sources.length > 0,
      cached: true,
      retrieval_mode: "offline_cache",
      query_variants_used: [question],
      top_query_variant: question,
    }

    onEvent({ type: "start" })
    onEvent({
      type: "retrieval",
      language: complete.language,
      retrieval_mode: complete.retrieval_mode,
      query_variants_used: complete.query_variants_used,
      top_query_variant: complete.top_query_variant,
      sufficient_evidence: complete.sufficient_evidence,
    })
    onEvent({ type: "token", text: complete.answer })
    onEvent({ type: "sources", sources: complete.sources })
    onEvent(complete)
    cacheHistory([
      {
        id: `${sessionId}-${new Date().toISOString()}`,
        user_id: userId,
        session_id: sessionId,
        document_id: documentId,
        question,
        answer: complete.answer,
        language: complete.language,
        sources: complete.sources,
        timestamp: new Date().toISOString(),
        confidence: complete.confidence,
        confidence_label: complete.confidence_label,
        latency_ms: complete.latency_ms,
        model_used: complete.model_used,
        sufficient_evidence: complete.sufficient_evidence,
      },
    ])
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}/api/chat/ask-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        document_id: documentId,
        document_name: documentName,
        session_id: sessionId,
        question,
        model_override: modelOverride,
        enable_query_augmentation: enableQueryAugmentation,
      }),
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    runOfflineFallback()
    return
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") ?? "60"
    throw new Error(
      `Too many requests — please wait ${retryAfter} seconds and try again.`
    )
  }
  if (!res.ok || !res.body) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      runOfflineFallback()
      return
    }
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
        const event: ChatStreamEvent = JSON.parse(line.slice(6))
        onEvent(event)
        if (event.type === "complete") {
          cacheAnswerSources({
            documentId,
            documentName,
            question,
            answer: event.answer,
            sources: event.sources ?? [],
          })
          cacheHistory([
            {
              id: `${sessionId}-${new Date().toISOString()}`,
              user_id: userId,
              session_id: sessionId,
              document_id: documentId,
              question,
              answer: event.answer,
              language: event.language,
              sources: event.sources ?? [],
              timestamp: new Date().toISOString(),
              confidence: event.confidence,
              confidence_label: event.confidence_label,
              latency_ms: event.latency_ms,
              model_used: event.model_used,
              sufficient_evidence: event.sufficient_evidence,
            },
          ])
        }
      } catch {}
    }
  }
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
export const DEFAULT_CHAT_MODEL_ID = "groq/compound"

export const GROQ_MODELS = [
  {
    id: "groq/compound",
    label: "Groq Compound",
    tag: "Recommended chat default",
    recommended: true,
    tier: 1,
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    tag: "⭐ Recommended · 30K TPM · 500K/day",
    rpm: 30,
    rpd: "1K",
    tpm: "30K",
    tpd: "500K",
    recommended: false,
  },
  {
    id: "groq/compound-mini",
    label: "Groq Compound Mini",
    tag: "⚠️ Low TPM limit — may rate limit",
    rpm: 30,
    rpd: "250",
    recommended: false,
    tier: 2,
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
