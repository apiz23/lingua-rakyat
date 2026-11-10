import type { ChatStreamEvent, SourceChunk } from "./chat-types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isSourceChunk(value: unknown): value is SourceChunk {
  if (!isRecord(value)) return false;
  if (
    typeof value.text !== "string" ||
    typeof value.document_id !== "string" ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score)
  )
    return false;
  for (const key of ["source_id", "doc_name", "section_title"]) {
    if (value[key] !== undefined && typeof value[key] !== "string")
      return false;
  }
  for (const key of ["page_start", "page_end"]) {
    if (
      value[key] !== undefined &&
      value[key] !== null &&
      (typeof value[key] !== "number" ||
        !Number.isInteger(value[key]) ||
        Number(value[key]) < 1)
    )
      return false;
  }
  for (const key of ["vector_score", "rerank_score"]) {
    if (
      value[key] !== undefined &&
      (typeof value[key] !== "number" || !Number.isFinite(value[key]))
    )
      return false;
  }
  return (
    value.confidence_label === undefined ||
    value.confidence_label === "high" ||
    value.confidence_label === "medium" ||
    value.confidence_label === "low"
  );
}

function isSourceArray(value: unknown): value is SourceChunk[] {
  return Array.isArray(value) && value.every(isSourceChunk);
}

/** Parse and validate an untrusted JSON SSE payload. Invalid events are ignored. */
export function parseChatStreamEvent(value: unknown): ChatStreamEvent | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  switch (value.type) {
    case "start":
      return { type: value.type };
    case "token":
      return typeof value.text === "string"
        ? { type: "token", text: value.text }
        : null;
    case "sources":
      return isSourceArray(value.sources)
        ? { type: "sources", sources: value.sources }
        : null;
    case "error":
      return typeof value.detail === "string"
        ? { type: "error", detail: value.detail }
        : null;
    case "suggestions":
      return isStringArray(value.questions)
        ? { type: "suggestions", questions: value.questions }
        : null;
    case "retrieval":
      if (
        typeof value.language !== "string" ||
        typeof value.retrieval_mode !== "string" ||
        !isStringArray(value.query_variants_used) ||
        typeof value.top_query_variant !== "string"
      )
        return null;
      return {
        type: "retrieval",
        language: value.language,
        retrieval_mode: value.retrieval_mode,
        query_variants_used: value.query_variants_used,
        top_query_variant: value.top_query_variant,
        ...(typeof value.sufficient_evidence === "boolean"
          ? { sufficient_evidence: value.sufficient_evidence }
          : {}),
      };
    case "complete":
      if (
        typeof value.answer !== "string" ||
        !isSourceArray(value.sources) ||
        typeof value.language !== "string" ||
        typeof value.confidence !== "number" ||
        !Number.isFinite(value.confidence) ||
        typeof value.latency_ms !== "number" ||
        !Number.isFinite(value.latency_ms) ||
        typeof value.model_used !== "string" ||
        typeof value.sufficient_evidence !== "boolean" ||
        typeof value.cached !== "boolean"
      )
        return null;
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
      };
    default:
      return null;
  }
}
