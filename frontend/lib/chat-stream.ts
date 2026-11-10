import type { AnswerVerification, ChatStreamEvent, SourceChunk } from "./api"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isSourceChunk(value: unknown): value is SourceChunk {
  if (!isRecord(value)) return false
  if (
    typeof value.text !== "string" ||
    typeof value.document_id !== "string" ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score)
  )
    return false
  for (const key of ["source_id", "doc_name", "section_title"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") return false
  }
  for (const key of ["page_start", "page_end"]) {
    if (
      value[key] !== undefined &&
      value[key] !== null &&
      (typeof value[key] !== "number" ||
        !Number.isInteger(value[key]) ||
        Number(value[key]) < 1)
    )
      return false
  }
  for (const key of ["vector_score", "rerank_score"]) {
    if (
      value[key] !== undefined &&
      (typeof value[key] !== "number" || !Number.isFinite(value[key]))
    )
      return false
  }
  return (
    value.confidence_label === undefined ||
    value.confidence_label === "high" ||
    value.confidence_label === "medium" ||
    value.confidence_label === "low"
  )
}

function isSourceArray(value: unknown): value is SourceChunk[] {
  return Array.isArray(value) && value.every(isSourceChunk)
}

function parseVerification(
  value: unknown,
  sources: unknown[]
): AnswerVerification | null {
  if (!isRecord(value)) return null
  const statuses = [
    "verified",
    "partially_supported",
    "unsupported",
    "conflicting",
    "unverifiable",
  ]
  const claimStatuses = [
    "supported",
    "partially_supported",
    "unsupported",
    "conflicting",
    "unverifiable",
  ]
  if (
    !statuses.includes(String(value.verification_status)) ||
    !Array.isArray(value.claims) ||
    typeof value.citation_valid !== "boolean" ||
    typeof value.extraction_complete !== "boolean" ||
    typeof value.extraction_status !== "string" ||
    typeof value.verification_summary !== "string" ||
    typeof value.revision_attempted !== "boolean" ||
    typeof value.abstained !== "boolean" ||
    ![
      "verified_claim_count",
      "partially_supported_claim_count",
      "unsupported_claim_count",
      "conflicting_claim_count",
      "unverifiable_claim_count",
    ].every((key) => Number.isInteger(value[key]) && Number(value[key]) >= 0)
  )
    return null

  const claims = value.claims
  if (
    !claims.every(
      (claim) =>
        isRecord(claim) &&
        typeof claim.claim_id === "string" &&
        typeof claim.text === "string" &&
        claimStatuses.includes(String(claim.status)) &&
        isStringArray(claim.supporting_source_ids) &&
        isStringArray(claim.conflicting_source_ids)
    )
  )
    return null

  const verification = value as unknown as AnswerVerification
  if (verification.verification_status === "verified") {
    const currentSourceIds = new Set(
      sources
        .filter(isRecord)
        .map((source) => source.source_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
    const verifiedClaimsAreGrounded =
      verification.claims.length > 0 &&
      verification.claims.every(
        (claim) =>
          claim.status === "supported" &&
          claim.supporting_source_ids.length > 0 &&
          claim.supporting_source_ids.every((id) => currentSourceIds.has(id)) &&
          claim.conflicting_source_ids.length === 0
      )
    if (
      verification.extraction_complete !== true ||
      verification.extraction_status !== "complete" ||
      verification.citation_valid !== true ||
      !verifiedClaimsAreGrounded
    )
      return null
  }
  return verification
}

/** Parse and validate an untrusted JSON SSE payload. Invalid events are ignored. */
export function parseChatStreamEvent(value: unknown): ChatStreamEvent | null {
  if (!isRecord(value) || typeof value.type !== "string") return null
  switch (value.type) {
    case "start":
    case "verifying":
      return { type: value.type }
    case "token":
      return typeof value.text === "string"
        ? { type: "token", text: value.text }
        : null
    case "sources":
      return isSourceArray(value.sources)
        ? { type: "sources", sources: value.sources }
        : null
    case "error":
      return typeof value.detail === "string"
        ? { type: "error", detail: value.detail }
        : null
    case "suggestions":
      return isStringArray(value.questions)
        ? { type: "suggestions", questions: value.questions }
        : null
    case "retrieval":
      if (
        typeof value.language !== "string" ||
        typeof value.retrieval_mode !== "string" ||
        !isStringArray(value.query_variants_used) ||
        typeof value.top_query_variant !== "string"
      )
        return null
      return {
        type: "retrieval",
        language: value.language,
        retrieval_mode: value.retrieval_mode,
        query_variants_used: value.query_variants_used,
        top_query_variant: value.top_query_variant,
        ...(typeof value.sufficient_evidence === "boolean"
          ? { sufficient_evidence: value.sufficient_evidence }
          : {}),
      }
    case "complete":
      if (typeof value.answer !== "string" || !isSourceArray(value.sources))
        return null
      return {
        type: "complete",
        answer: value.answer,
        confidence_label:
          value.confidence_label === "high" ||
          value.confidence_label === "medium" ||
          value.confidence_label === "low"
            ? value.confidence_label
            : undefined,
        evidence_mode:
          typeof value.evidence_mode === "string"
            ? value.evidence_mode
            : undefined,
        retrieval_mode:
          typeof value.retrieval_mode === "string"
            ? value.retrieval_mode
            : undefined,
        query_variants_used: isStringArray(value.query_variants_used)
          ? value.query_variants_used
          : undefined,
        top_query_variant:
          typeof value.top_query_variant === "string"
            ? value.top_query_variant
            : undefined,
        faithfulness:
          typeof value.faithfulness === "number" &&
          Number.isFinite(value.faithfulness)
            ? value.faithfulness
            : null,
        confidence_explanation:
          typeof value.confidence_explanation === "string"
            ? value.confidence_explanation
            : null,
        sources: value.sources,
        language: typeof value.language === "string" ? value.language : "en",
        confidence: typeof value.confidence === "number" ? value.confidence : 0,
        latency_ms: typeof value.latency_ms === "number" ? value.latency_ms : 0,
        model_used:
          typeof value.model_used === "string" ? value.model_used : "unknown",
        sufficient_evidence: value.sufficient_evidence === true,
        cached: value.cached === true,
        verification:
          value.answer.trim() === "" || value.verification == null
            ? null
            : parseVerification(value.verification, value.sources),
      }
    default:
      return null
  }
}

export class ChatStreamInterruptedError extends Error {
  constructor() {
    super("Chat response ended before a final answer was received")
    this.name = "ChatStreamInterruptedError"
  }
}

export type VerificationLifecycleState =
  | "generating"
  | "verifying"
  | AnswerVerification["verification_status"]

export function getVerificationLifecycleState(input: {
  isStreaming?: boolean
  verifying?: boolean
  verification?: AnswerVerification | null
  sources?: SourceChunk[]
}): VerificationLifecycleState {
  if (input.isStreaming) return input.verifying ? "verifying" : "generating"
  const verification = input.verification
  if (
    !verification ||
    ![
      "verified",
      "partially_supported",
      "unsupported",
      "conflicting",
      "unverifiable",
    ].includes(verification.verification_status)
  ) {
    return "unverifiable"
  }
  if (verification.verification_status !== "verified")
    return verification.verification_status
  const sourceIds = new Set(
    (input.sources ?? []).map((source) => source.source_id).filter(Boolean)
  )
  const safe =
    verification.extraction_complete === true &&
    verification.extraction_status === "complete" &&
    verification.citation_valid === true &&
    Array.isArray(verification.claims) &&
    verification.claims.length > 0 &&
    verification.claims.every(
      (claim) =>
        claim?.status === "supported" &&
        Array.isArray(claim.supporting_source_ids) &&
        claim.supporting_source_ids.length > 0 &&
        claim.supporting_source_ids.every((id) => sourceIds.has(id)) &&
        Array.isArray(claim.conflicting_source_ids) &&
        claim.conflicting_source_ids.length === 0
    )
  return safe ? "verified" : "unverifiable"
}

/** Read SSE frames robustly, deliver only validated events, and require a terminal result. */
export async function consumeChatSse(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = stream.getReader()
  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  signal?.addEventListener("abort", cancel, { once: true })
  const decoder = new TextDecoder()
  let buffer = ""
  let dataLines: string[] = []
  let completed = false
  let failed = false

  const dispatch = () => {
    if (signal?.aborted || failed || !dataLines.length) return
    const raw = dataLines.join("\n")
    dataLines = []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    const event = parseChatStreamEvent(parsed)
    if (!event) return
    if (completed) {
      if (event.type !== "suggestions") return
    } else if (event.type === "complete") {
      completed = true
    } else if (event.type === "error") {
      failed = true
    }
    onEvent(event)
  }

  const processLine = (rawLine: string) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
    if (line === "") {
      dispatch()
      return
    }
    if (line.startsWith(":")) return
    if (line.startsWith("data:"))
      dataLines.push(line.slice(5).replace(/^ /, ""))
  }

  try {
    if (signal?.aborted) {
      cancel()
      throw new DOMException("Request cancelled", "AbortError")
    }
    while (!failed) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) processLine(line)
      if (failed) break
    }
    if (!failed) {
      buffer += decoder.decode()
      if (buffer) processLine(buffer)
      dispatch()
    }
    if (signal?.aborted)
      throw new DOMException("Request cancelled", "AbortError")
  } catch (error) {
    if (signal?.aborted)
      throw new DOMException("Request cancelled", "AbortError")
    if (!completed) throw error
  } finally {
    signal?.removeEventListener("abort", cancel)
    try {
      reader.releaseLock()
    } catch {
    }
  }

  if (!completed && !failed) throw new ChatStreamInterruptedError()
}
