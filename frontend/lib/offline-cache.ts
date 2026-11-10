import type { ChatHistoryMessage, Document, SourceChunk } from "@/lib/api"

const LEGACY_KEYS = [
  ["documents", "lr-offline-documents:v1"],
  ["history", "lr-offline-history:v1"],
  ["sources", "lr-offline-sources:v1"],
] as const
export type OfflineCleanupResult = { ok: boolean; failed: Array<(typeof LEGACY_KEYS)[number][0]> }

/** Remove data written by older versions. Never read it, even if removal fails. */
export function purgeLegacyOfflineData(): OfflineCleanupResult {
  const failed: OfflineCleanupResult["failed"] = []
  for (const [category, key] of LEGACY_KEYS) {
    try {
      if (typeof window === "undefined") throw new Error("Storage unavailable")
      window.localStorage.removeItem(key)
    } catch {
      failed.push(category)
    }
  }
  return { ok: failed.length === 0, failed }
}

export function cacheDocuments(documents: Document[]): void { void documents }
export function getCachedDocuments(): Document[] { return [] }
export function cacheHistory(messages: ChatHistoryMessage[]): void { void messages }
export function getCachedHistory(params?: { documentId?: string; sessionId?: string; userId?: string }): ChatHistoryMessage[] { void params; return [] }
export function cacheAnswerSources(args: { documentId: string; documentName: string; question: string; answer: string; sources: SourceChunk[] }): void { void args }

/** Compatibility for older clients: no stored content is consulted. */
export function offlineSearchAnswer(args: { question: string; documentId: string; documentName: string; language?: string }) {
  void args
  return { answer: "Documents and saved answers are unavailable offline. Reconnect to continue.", sources: [] as SourceChunk[], confidence: 0, confidence_label: "low" as const }
}
