
import { z, type ZodType } from "zod"
import {
  AnswerVerificationSchema,
  AskResponseSchema,
  AugmentResultSchema,
  ChatHistoryMessageSchema,
  ClaimVerificationStatusSchema,
  ClearHistoryResultSchema,
  ConversationSummarySchema,
  DocumentSchema,
  DocumentStatusSchema,
  EvalReportSchema,
  MyShareSchema,
  SharedAnswerSchema,
  ShareResultSchema,
  SimplifyDemoSchema,
  SourceChunkSchema,
  StreamEventSchema,
  TestSuiteResultSchema,
  VerificationStatusSchema,
} from "@/lib/api-schemas"
import {
  cacheAnswerSources,
  cacheDocuments,
  cacheHistory,
  getCachedDocuments,
  getCachedHistory,
} from "@/lib/offline-cache"
import { consumeChatSse } from "@/lib/chat-stream"
import { authorizedFetch, publicFetch, resolveApiUrl } from "@/lib/http"

function apiBase(): string {
  return resolveApiUrl("")
}

class HistoryAuthorizationError extends Error {
  constructor() {
    super("Sign in to access saved chat history")
    this.name = "HistoryAuthorizationError"
  }
}


export type Document = z.infer<typeof DocumentSchema>

export type SourceChunk = z.infer<typeof SourceChunkSchema>

export type ClaimVerificationStatus = z.infer<
  typeof ClaimVerificationStatusSchema
>

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>

export type AnswerVerification = z.infer<typeof AnswerVerificationSchema>

export type AskResponse = z.infer<typeof AskResponseSchema>

export type ChatHistoryMessage = z.infer<typeof ChatHistoryMessageSchema>


export type EvalReport = z.infer<typeof EvalReportSchema>

export type TestSuiteResult = z.infer<typeof TestSuiteResultSchema>

export type SimplifyDemo = z.infer<typeof SimplifyDemoSchema>

export type AugmentResult = z.infer<typeof AugmentResultSchema>

async function apiFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  return authorizedFetch(String(input), init)
}

async function parseJson<T>(res: Response, schema: ZodType<T>): Promise<T> {
  const payload: unknown = await res.json()
  return schema.parse(payload)
}

async function errorDetail(res: Response, fallback: string): Promise<string> {
  const payload: unknown = await res.json().catch(() => null)
  const parsed = z.object({ detail: z.string() }).safeParse(payload)
  return parsed.success ? parsed.data.detail : fallback
}

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>

export async function getDocumentStatus(
  documentId: string
): Promise<DocumentStatus> {
  const res = await apiFetch(`${apiBase()}/api/documents/${documentId}/status`)
  if (!res.ok) throw new Error("Failed to fetch document status")
  return parseJson(res, DocumentStatusSchema)
}

export async function waitForDocumentReady(
  documentId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<DocumentStatus> {
  const intervalMs = opts.intervalMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 180000
  const startedAt = Date.now()
  while (true) {
    const status = await getDocumentStatus(documentId)
    if (status.status !== "processing") return status
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Document is taking longer than expected — check the document list later.")
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

export async function listDocuments(signal?: AbortSignal): Promise<Document[]> {
  try {
    const res = await apiFetch(`${apiBase()}/api/documents/`, { signal })
    if (!res.ok) throw new Error("Failed to fetch documents")
    const documents = await parseJson(res, z.array(DocumentSchema))
    cacheDocuments(documents)
    return documents
  } catch (error) {
    if (signal?.aborted) throw error
    const cached = getCachedDocuments()
    if (cached.length) return cached
    throw error
  }
}

export async function askQuestion(
  userId: string,
  documentId: string,
  documentName: string,
  sessionId: string,
  question: string,
  modelOverride: string = "",
  enableQueryAugmentation: boolean = true,
  bypassCache: boolean = false,
  documentIds: string[] = []
): Promise<AskResponse> {
  const res = await apiFetch(`${apiBase()}/api/chat/ask`, {
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
      bypass_cache: bypassCache,
      document_ids: documentIds,
    }),
  })
  if (!res.ok) {
    throw new Error(await errorDetail(res, "Failed to get answer"))
  }
  return parseJson(res, AskResponseSchema)
}

export async function getChatHistory(params: {
  userId: string
  documentId?: string
  sessionId?: string
  signal?: AbortSignal
}): Promise<ChatHistoryMessage[]> {
  const search = new URLSearchParams()
  if (params.documentId) search.set("document_ref", params.documentId)
  if (params.sessionId) search.set("conversation_ref", params.sessionId)

  try {
    const res = await apiFetch(`${apiBase()}/api/v1/me/history?${search.toString()}`, {
      ...(params.signal ? { signal: params.signal } : {}),
    })
    if (res.status === 401 || res.status === 403) throw new HistoryAuthorizationError()
    if (!res.ok) throw new Error("Failed to fetch chat history")
    const messages = await parseJson(res, z.array(ChatHistoryMessageSchema))
    cacheHistory(messages)
    return messages
  } catch (error) {
    if (error instanceof HistoryAuthorizationError) throw error
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
  signal?: AbortSignal
}): Promise<{ success: boolean; message: string; deleted_rows: number }> {
  const search = new URLSearchParams()
  search.set("document_ref", params.documentId)
  if (params.sessionId) search.set("conversation_ref", params.sessionId)

  const suffix = search.toString() ? `?${search.toString()}` : ""
  const res = await apiFetch(
    `${apiBase()}/api/v1/me/history${suffix}`,
    { method: "DELETE", signal: params.signal }
  )
  if (!res.ok) throw new Error("Failed to clear chat history")
  return parseJson(res, ClearHistoryResultSchema)
}


export async function getEvalReport(): Promise<EvalReport> {
  const res = await apiFetch(`${apiBase()}/api/eval/report`)
  if (!res.ok) throw new Error("Failed to fetch evaluation report")
  return parseJson(res, EvalReportSchema)
}

export async function runTestSuite(
  documentId: string,
  docName: string = "",
  modelOverride: string = ""
): Promise<TestSuiteResult> {
  const res = await apiFetch(`${apiBase()}/api/eval/run-test-suite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      doc_name: docName,
      model_override: modelOverride,
    }),
  })
  if (!res.ok) {
    throw new Error(await errorDetail(res, "Test suite failed"))
  }
  return parseJson(res, TestSuiteResultSchema)
}

export async function getSimplifyDemo(): Promise<SimplifyDemo> {
  const res = await apiFetch(`${apiBase()}/api/eval/simplify-demo`)
  if (!res.ok) throw new Error("Failed to fetch simplify demo")
  return parseJson(res, SimplifyDemoSchema)
}

export async function augmentQuery(
  query: string,
  sourceLang: string = "en"
): Promise<AugmentResult> {
  const res = await apiFetch(`${apiBase()}/api/eval/augment-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, source_lang: sourceLang }),
  })
  if (!res.ok) throw new Error("Failed to augment query")
  return parseJson(res, AugmentResultSchema)
}

export async function clearEvalRecords(uploadToken?: string): Promise<void> {
  const params = uploadToken ? `?upload_token=${encodeURIComponent(uploadToken)}` : ""
  const res = await apiFetch(`${apiBase()}/api/eval/clear${params}`, { method: "DELETE" })
  if (!res.ok) {
    throw new Error(await errorDetail(res, "Failed to clear eval records"))
  }
}


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
  | { type: "verifying" }
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
      evidence_mode?: string
      cached: boolean
      retrieval_mode?: string
      query_variants_used?: string[]
      top_query_variant?: string
      faithfulness?: number | null
      confidence_explanation?: string | null
      verification?: AnswerVerification | null
    }
  | { type: "suggestions"; questions: string[] }
  | { type: "error"; detail: string }

export async function askQuestionStream(
  userId: string,
  documentId: string,
  documentName: string,
  sessionId: string,
  question: string,
  modelOverride: string = "",
  enableQueryAugmentation: boolean = true,
  bypassCache: boolean = false,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
  chatHistory?: Array<{ question: string; answer: string }>,
  documentIds?: string[],
  uiLanguage: "en" | "ms" | "zh" = "en",
): Promise<void> {
  const runOfflineFallback = () => {
    const messages = {
      en: "Documents and saved answers are unavailable offline. Reconnect to continue.",
      ms: "Dokumen dan jawapan tersimpan tidak tersedia di luar talian. Sambung semula untuk meneruskan.",
      zh: "离线时无法访问文件和已保存的答案。请重新连接网络以继续。",
    }
    onEvent({ type: "error", detail: messages[uiLanguage] })
  }

  let res: Response
  try {
    res = await authorizedFetch(`${apiBase()}/api/chat/ask-stream`, {
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
        bypass_cache: bypassCache,
        chat_history: chatHistory ?? [],
        document_ids: documentIds ?? [],
      }),
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    runOfflineFallback()
    return
  }

  if (!res.ok || !res.body) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      runOfflineFallback()
      return
    }
    throw new Error(await errorDetail(res, "Stream failed"))
  }
  await consumeChatSse(res.body, (event) => {
    if (signal?.aborted) return
    onEvent(event)
    if (event.type !== "complete") return
    cacheAnswerSources({
      documentId,
      documentName,
      question,
      answer: event.answer,
      sources: event.sources,
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
        sources: event.sources,
        timestamp: new Date().toISOString(),
        confidence: event.confidence,
        confidence_label: event.confidence_label,
        latency_ms: event.latency_ms,
        model_used: event.model_used,
        sufficient_evidence: event.sufficient_evidence,
        faithfulness: event.faithfulness,
        confidence_explanation: event.confidence_explanation,
        verification: event.verification,
      },
    ])
  }, signal)
}


export type StreamEvent = z.infer<typeof StreamEventSchema>
export type StreamProgressEvent = Extract<StreamEvent, { type: "progress" }>
export type StreamAggregateEvent = Extract<StreamEvent, { type: "aggregate" }>
export type StreamErrorEvent = Extract<StreamEvent, { type: "error" }>
export type StreamDoneEvent = Extract<StreamEvent, { type: "done" }>
export type StreamSkippedEvent = Extract<StreamEvent, { type: "skipped" }>
export type StreamCategoryEvent = Extract<StreamEvent, { type: "category" }>

export async function runTestSuiteStream(
  documentId: string,
  docName: string = "",
  modelOverride: string = "",
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await authorizedFetch(`${apiBase()}/api/eval/run-test-suite-stream`, {
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
    throw new Error(await errorDetail(res, "Stream failed"))
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
        const event = StreamEventSchema.parse(JSON.parse(line.slice(6)))
        onEvent(event)
      } catch {}
    }
  }
}

export const DEFAULT_CHAT_MODEL_ID = "openai/gpt-oss-120b"

export const GROQ_MODELS = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    tag: "⭐ Recommended · reasoning · 8K TPM · 200K/day",
    rpm: 30,
    rpd: "1K",
    tpm: "8K",
    tpd: "200K",
    recommended: true,
    tier: 1,
  },
  {
    id: "qwen/qwen3.6-27b",
    label: "Qwen3.6 27B",
    tag: "Preview · strong 中文 · 8K TPM · 200K/day",
    rpm: 30,
    rpd: "1K",
    tpm: "8K",
    tpd: "200K",
    recommended: false,
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    tag: "Fast reasoning · 8K TPM · 200K/day",
    rpm: 30,
    rpd: "1K",
    tpm: "8K",
    tpd: "200K",
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


export type ConversationSummary = z.infer<typeof ConversationSummarySchema>

export async function listConversations(userId: string, signal?: AbortSignal): Promise<ConversationSummary[]> {
  void userId // Retained for caller compatibility; identity comes from Clerk.
  try {
    const res = await apiFetch(`${apiBase()}/api/v1/me/conversations`, { signal })
    if (res.status === 401 || res.status === 403) throw new HistoryAuthorizationError()
    if (!res.ok) return []
    return parseJson(res, z.array(ConversationSummarySchema))
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof HistoryAuthorizationError) throw error
    return []
  }
}

export async function renameConversation(
  userId: string,
  sessionId: string,
  title: string,
  signal?: AbortSignal,
): Promise<boolean> {
  void userId // The API derives ownership from the verified Clerk principal.
  try {
    const res = await apiFetch(`${apiBase()}/api/v1/me/conversations/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    return res.ok
  } catch {
    return false
  }
}


export type ShareResult = z.infer<typeof ShareResultSchema>

export type SharedAnswer = z.infer<typeof SharedAnswerSchema>

export async function createShare(payload: {
  session_id: string
  question: string
  answer: string
}, signal?: AbortSignal): Promise<ShareResult> {
  const res = await apiFetch(`${apiBase()}/api/v1/me/shares`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await errorDetail(res, "Failed to create share link"))
  }
  return parseJson(res, ShareResultSchema)
}

export async function submitAnswerFeedback(
  payload: {
    sessionId: string
    question: string
    docId: string
    feedback: "up" | "down"
  },
  signal?: AbortSignal
): Promise<void> {
  try {
    await publicFetch(`${apiBase()}/api/v1/public/feedback`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: payload.sessionId,
        question: payload.question,
        doc_id: payload.docId,
        feedback: payload.feedback,
      }),
    })
  } catch {
    // Feedback is best-effort; a failed submit must never interrupt the chat.
  }
}

export async function getShare(slug: string): Promise<SharedAnswer | null> {  try {
    const res = await publicFetch(`${apiBase()}/api/v1/public/shares/${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    return parseJson(res, SharedAnswerSchema)
  } catch {
    return null
  }
}

export type MyShare = z.infer<typeof MyShareSchema>

export async function listMyShares(): Promise<MyShare[]> {
  try {
    const res = await apiFetch(`${apiBase()}/api/v1/me/shares`)
    if (!res.ok) return []
    return await parseJson(res, z.array(MyShareSchema))
  } catch {
    return []
  }
}

export async function revokeShare(slug: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${apiBase()}/api/v1/me/shares/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    })
    return res.ok
  } catch {
    return false
  }
}
