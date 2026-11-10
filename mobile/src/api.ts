import type { SourceChunk, ChatStreamEvent } from "./chat-types"
export type { SourceChunk, ChatStreamEvent } from "./chat-types"
import { parseChatStreamEvent } from "./chat-stream"

import { fetch as streamingFetch } from "expo/fetch"
import { authHeader } from "./auth-token"

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://lingua-rakyat-ai.vercel.app"

export const DEFAULT_CHAT_MODEL_ID = "openai/gpt-oss-120b"


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
  is_featured?: boolean
  agency?: string
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
  faithfulness?: number | null
  confidence_explanation?: string | null
}

export interface ConversationSummary {
  session_id: string
  title: string
  last_at: string
  count: number
  custom_title?: string
}

export interface ShareResult {
  slug: string
  url: string
}

export interface SharedAnswer {
  slug: string
  question: string
  answer: string
  sources: SourceChunk[]
  language: string
  created_at: string
  confidence: number
  confidence_label: string
  agency: string
  evidence_linked: boolean
}

export interface MyShare {
  slug: string
  question: string
  confidence_label: string
  agency: string
  created_at: string
}


export class RateLimitError extends Error {
  waitSeconds: number
  constructor(waitSeconds: number) {
    super(`Rate limited — wait ${waitSeconds}s`)
    this.waitSeconds = waitSeconds
  }
}

/** Raised when the backend rejects the caller's session. Callers must show a
 *  reauthentication prompt; they must never silently retry as anonymous. */
export class AuthRequiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.")
    this.name = "AuthRequiredError"
  }
}

async function apiFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const auth = await authHeader()
  const withAuth = (extra: Record<string, string>): RequestInit => ({
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      ...extra,
    },
  })
  let res = await fetch(input, withAuth(auth))
  if (res.status === 401 && auth.Authorization) {
    const refreshed = await authHeader()
    if (refreshed.Authorization && refreshed.Authorization !== auth.Authorization) {
      res = await fetch(input, withAuth(refreshed))
    }
  }
  if (res.status === 429) {
    const retryAfter = parseInt(
      res.headers.get("Retry-After") ?? "60",
      10
    )
    throw new RateLimitError(Number.isNaN(retryAfter) ? 60 : retryAfter)
  }
  return res
}


export async function listDocuments(): Promise<Document[]> {
  const res = await apiFetch(`${API_URL}/api/documents/`)
  if (!res.ok) throw new Error("Failed to fetch documents")
  return res.json()
}

export async function getDocumentStatus(
  documentId: string
): Promise<{ id: string; status: string; chunk_count: number; error_message?: string | null }> {
  const res = await apiFetch(`${API_URL}/api/documents/${documentId}/status`)
  if (!res.ok) throw new Error("Failed to fetch document status")
  return res.json()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/documents/${documentId}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to delete document" }))
    throw new Error(err.detail || "Failed to delete document")
  }
}


export async function getChatHistory(params: {
  userId: string
  documentId?: string
  sessionId?: string
}): Promise<ChatHistoryMessage[]> {
  const search = new URLSearchParams()
  if (params.documentId) search.set("document_ref", params.documentId)
  if (params.sessionId) search.set("conversation_ref", params.sessionId)
  const res = await apiFetch(
    `${API_URL}/api/v1/me/history?${search.toString()}`
  )
  if (!res.ok) throw new Error("Failed to fetch chat history")
  return res.json()
}

export async function clearChatHistory(params: {
  documentId: string
  userId?: string
  sessionId?: string
}): Promise<{ success: boolean; message: string; deleted_rows: number }> {
  const search = new URLSearchParams()
  search.set("document_ref", params.documentId)
  if (params.sessionId) search.set("conversation_ref", params.sessionId)
  const suffix = search.toString() ? `?${search.toString()}` : ""
  const res = await apiFetch(
    `${API_URL}/api/v1/me/history${suffix}`,
    { method: "DELETE" }
  )
  if (!res.ok) throw new Error("Failed to clear chat history")
  return res.json()
}


export async function listConversations(
  userId: string
): Promise<ConversationSummary[]> {
  void userId // Retained for caller compatibility; identity comes from Clerk.
  try {
    const res = await apiFetch(`${API_URL}/api/v1/me/conversations`)
    if (res.status === 401 || res.status === 403) {
      throw new Error("HistoryAuthorizationError")
    }
    if (!res.ok) return []
    return res.json()
  } catch (error) {
    if (error instanceof Error && error.message === "HistoryAuthorizationError") throw error
    return []
  }
}

export async function renameConversation(
  userId: string,
  sessionId: string,
  title: string
): Promise<boolean> {
  void userId // The API derives ownership from the verified Clerk principal.
  try {
    const res = await apiFetch(
      `${API_URL}/api/v1/me/conversations/${encodeURIComponent(sessionId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}


export async function createShare(payload: {
  session_id: string
  question: string
  answer: string
}): Promise<ShareResult> {
  const res = await apiFetch(`${API_URL}/api/v1/me/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to create share link" }))
    throw new Error(error.detail || "Failed to create share link")
  }
  return res.json()
}

export async function getShare(
  slug: string
): Promise<SharedAnswer | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/public/shares/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function listMyShares(): Promise<MyShare[]> {
  try {
    const res = await apiFetch(`${API_URL}/api/v1/me/shares`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function revokeShare(slug: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_URL}/api/v1/me/shares/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    })
    return res.ok
  } catch {
    return false
  }
}


export async function askQuestionStream(
  params: {
    userId: string
    anonUserId?: string
    documentId: string
    documentName: string
    sessionId: string
    question: string
    chatHistory?: Array<{ question: string; answer: string }>
    documentIds?: string[]
    requireAuth?: boolean
    signal?: AbortSignal
  },
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
  }
  if (params.requireAuth && !headers.Authorization) throw new AuthRequiredError()
  const res = await streamingFetch(`${API_URL}/api/chat/ask-stream`, {
    method: "POST",
    headers,
    signal: params.signal,
    body: JSON.stringify({
      user_id: params.userId,
      document_id: params.documentId,
      document_name: params.documentName,
      session_id: params.sessionId,
      question: params.question,
      model_override: DEFAULT_CHAT_MODEL_ID,
      enable_query_augmentation: true,
      bypass_cache: false,
      chat_history: params.chatHistory ?? [],
      document_ids: params.documentIds ?? [],
    }),
  })

  if (res.status === 401) throw new AuthRequiredError()

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10)
    throw new RateLimitError(Number.isNaN(retryAfter) ? 60 : retryAfter)
  }
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ detail: "Stream failed" }))
    throw new Error((err as { detail?: string }).detail || "Stream failed")
  }

  const reader = res.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => {}) }
  params.signal?.addEventListener("abort", cancel, { once: true })
  const decoder = new TextDecoder()
  let buffer = ""
  let terminal = false
  try {
  while (true) {
    if (params.signal?.aborted) throw new Error("Request cancelled")
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      try {
        const event = parseChatStreamEvent(JSON.parse(line.slice(6)))
        if (!event) continue
        if (event.type === "complete" || event.type === "error") terminal = true
        if (!params.signal?.aborted) onEvent(event)
      } catch {
      }
    }
  }
  if (params.signal?.aborted) throw new Error("Request cancelled")
  if (!terminal) throw new Error("The answer was interrupted. Please try again.")
  } finally {
    params.signal?.removeEventListener("abort", cancel)
    reader.releaseLock()
  }
}
