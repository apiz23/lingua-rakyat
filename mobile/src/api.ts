// API client for the Lingua Rakyat FastAPI backend. Same contract as the
// web app's frontend/lib/api.ts, trimmed to what mobile v1 uses.

import { fetch as streamingFetch } from "expo/fetch"
import { authHeader } from "./auth-token"

export const API_URL = "https://lingua-rakyat-ai.vercel.app"

export const DEFAULT_CHAT_MODEL_ID = "openai/gpt-oss-120b"

export type Document = {
  id: string
  name: string
  size_bytes: number
  chunk_count: number
  status: "processing" | "ready" | "error"
  uploaded_at: string
  is_featured?: boolean
  agency?: string
}

export type SourceChunk = {
  text: string
  document_id: string
  score: number
  doc_name?: string
  page_start?: number | null
  page_end?: number | null
  section_title?: string
  confidence_label?: "high" | "medium" | "low"
}

export type ChatStreamEvent =
  | { type: "start" }
  | {
      type: "retrieval"
      language: string
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
      confidence_explanation?: string | null
    }
  | { type: "suggestions"; questions: string[] }
  | { type: "error"; detail: string }

export async function listDocuments(): Promise<Document[]> {
  // Trailing slash matters — /api/documents (no slash) is a 405.
  const res = await fetch(`${API_URL}/api/documents/`)
  if (!res.ok) throw new Error(`Failed to fetch documents (${res.status})`)
  return res.json()
}

export class RateLimitError extends Error {
  waitSeconds: number
  constructor(waitSeconds: number) {
    super(`Rate limited — wait ${waitSeconds}s`)
    this.waitSeconds = waitSeconds
  }
}

export async function askQuestionStream(
  params: {
    userId: string
    documentId: string
    documentName: string
    sessionId: string
    question: string
    chatHistory?: Array<{ question: string; answer: string }>
    documentIds?: string[]
  },
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  // expo/fetch: WinterCG fetch with a streaming body — React Native's
  // built-in fetch buffers the whole response, which breaks SSE.
  const res = await streamingFetch(`${API_URL}/api/chat/ask-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
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

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10)
    throw new RateLimitError(Number.isNaN(retryAfter) ? 60 : retryAfter)
  }
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ detail: "Stream failed" }))
    throw new Error((err as { detail?: string }).detail || "Stream failed")
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
        onEvent(JSON.parse(line.slice(6)) as ChatStreamEvent)
      } catch {
        // Malformed SSE line — skip, same as the web client.
      }
    }
  }
}
