import type { ChatHistoryMessage, Document, SourceChunk } from "@/lib/api"

const DOCS_KEY = "lr-offline-documents:v1"
const HISTORY_KEY = "lr-offline-history:v1"
const SOURCES_KEY = "lr-offline-sources:v1"
const PDF_CACHE = "lingua-rakyat-pdfs-v1"

type OfflineSourceRecord = SourceChunk & {
  question: string
  answer: string
  document_name: string
  saved_at: string
}

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Local storage can be full or blocked. Offline mode should degrade quietly.
  }
}

export function cacheDocuments(documents: Document[]) {
  writeJson(DOCS_KEY, documents)
  cacheDocumentFiles(documents)
}

export function getCachedDocuments(): Document[] {
  return readJson<Document[]>(DOCS_KEY, [])
}

function cacheDocumentFiles(documents: Document[]) {
  if (typeof window === "undefined" || !("caches" in window)) return

  const urls = documents
    .map((document) => document.public_url)
    .filter((url): url is string => Boolean(url))

  if (!urls.length) return

  window.caches
    .open(PDF_CACHE)
    .then((cache) =>
      Promise.all(
        urls.map(async (url) => {
          const cached = await cache.match(url)
          if (cached) return
          const response = await fetch(new Request(url, { mode: "no-cors" }))
          await cache.put(url, response)
        })
      )
    )
    .catch(() => {})
}

export function cacheHistory(messages: ChatHistoryMessage[]) {
  const existing = getCachedHistory()
  const byId = new Map<string, ChatHistoryMessage>()
  for (const message of [...messages, ...existing]) {
    byId.set(message.id, message)
  }
  writeJson(HISTORY_KEY, Array.from(byId.values()).slice(0, 200))
}

export function getCachedHistory(params?: {
  documentId?: string
  sessionId?: string
  userId?: string
}): ChatHistoryMessage[] {
  const messages = readJson<ChatHistoryMessage[]>(HISTORY_KEY, [])
  return messages.filter((message) => {
    if (params?.documentId && message.document_id !== params.documentId) {
      return false
    }
    if (params?.sessionId && message.session_id !== params.sessionId) {
      return false
    }
    if (params?.userId && message.user_id !== params.userId) {
      return false
    }
    return true
  })
}

export function cacheAnswerSources(args: {
  documentId: string
  documentName: string
  question: string
  answer: string
  sources: SourceChunk[]
}) {
  if (!args.sources.length) return
  const existing = readJson<OfflineSourceRecord[]>(SOURCES_KEY, [])
  const records = args.sources.map((source) => ({
    ...source,
    document_id: args.documentId,
    doc_name: source.doc_name || args.documentName,
    question: args.question,
    answer: args.answer,
    document_name: args.documentName,
    saved_at: new Date().toISOString(),
  }))
  writeJson(SOURCES_KEY, [...records, ...existing].slice(0, 500))
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/i)
        .filter((token) => token.length >= 3)
    )
  )
}

function scoreText(text: string, tokens: string[]): number {
  const haystack = text.toLowerCase()
  return tokens.reduce((score, token) => {
    if (haystack.includes(token)) return score + Math.min(token.length, 10)
    return score
  }, 0)
}

function inferLanguage(text: string): "ms" | "en" {
  const lower = text.toLowerCase()
  const malayHints = [
    "apa",
    "bagaimana",
    "bila",
    "siapa",
    "kenapa",
    "boleh",
    "saya",
    "dokumen",
    "permohonan",
    "bantuan",
    "kerajaan",
  ]
  return malayHints.some((hint) => lower.includes(hint)) ? "ms" : "en"
}

export function offlineSearchAnswer(args: {
  question: string
  documentId: string
  documentName: string
  language?: string
}) {
  const tokens = tokenize(args.question)
  const records = readJson<OfflineSourceRecord[]>(SOURCES_KEY, []).filter(
    (record) => record.document_id === args.documentId
  )

  const ranked = records
    .map((record) => ({
      record,
      score:
        scoreText(record.text, tokens) * 1.2 +
        scoreText(record.question, tokens) +
        scoreText(record.answer, tokens) * 0.6,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const isMalay = (args.language ?? inferLanguage(args.question)) === "ms"
  if (!ranked.length) {
    return {
      answer: isMalay
        ? "- Mod luar talian aktif.\n- Saya tidak menemui petikan cache yang sepadan untuk soalan ini.\n- Sambung semula internet untuk carian RAG penuh."
        : "- Offline mode is active.\n- I could not find a matching cached excerpt for this question.\n- Reconnect to the internet for full RAG search.",
      sources: [] as SourceChunk[],
      confidence: 0.15,
      confidence_label: "low" as const,
    }
  }

  const sources = ranked.map(({ record, score }) => ({
    text: record.text,
    document_id: record.document_id,
    doc_name: record.doc_name || args.documentName,
    page_start: record.page_start,
    page_end: record.page_end,
    section_title: record.section_title,
    score: Math.min(0.7, Math.max(0.3, score / 40)),
    vector_score: record.vector_score ?? 0,
    rerank_score: record.rerank_score ?? 0,
    confidence_label: "medium" as const,
  }))

  const answerLines = sources.map((source) => {
    const page = source.page_start
      ? `, ${isMalay ? "halaman" : "page"} ${
          source.page_end && source.page_end !== source.page_start
            ? `${source.page_start}-${source.page_end}`
            : source.page_start
        }`
      : ""
    return `- ${source.text.slice(0, 220)}${source.text.length > 220 ? "..." : ""}\n  ${isMalay ? "Sumber" : "Source"}: ${source.doc_name}${page}`
  })

  return {
    answer: [
      isMalay
        ? "- Mod luar talian aktif. Jawapan ini berdasarkan petikan yang pernah dicache pada peranti ini."
        : "- Offline mode is active. This answer is based on excerpts previously cached on this device.",
      ...answerLines,
    ].join("\n"),
    sources,
    confidence: Math.max(...sources.map((source) => source.score)),
    confidence_label: "medium" as const,
  }
}
