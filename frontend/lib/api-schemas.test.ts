import { describe, expect, it } from "vitest"

import {
  AskResponseSchema,
  DocumentSchema,
  StreamEventSchema,
} from "./api-schemas"

const document = {
  id: "doc-1",
  name: "MyKad FAQ.pdf",
  size_bytes: 1024,
  chunk_count: 12,
  status: "ready",
  uploaded_at: "2026-01-01T00:00:00Z",
}

describe("API boundary schemas", () => {
  it("accepts a valid document", () => {
    expect(DocumentSchema.parse(document)).toEqual(document)
  })

  it("rejects an unknown document status", () => {
    const result = DocumentSchema.safeParse({ ...document, status: "queued" })
    expect(result.success).toBe(false)
  })

  it("rejects an answer payload without a sources array", () => {
    const result = AskResponseSchema.safeParse({
      answer: "Yes",
      language: "en",
      question: "Can I renew?",
      timestamp: "2026-01-01T00:00:00Z",
      confidence: 0.9,
      latency_ms: 10,
    })
    expect(result.success).toBe(false)
  })

  it("narrows stream events by type", () => {
    const parsed = StreamEventSchema.parse({
      type: "progress",
      index: 0,
      total: 2,
      result: {
        case_index: 0,
        language: "en",
        question: "q",
        answer: "a",
        ground_truth: "a",
        scores: {
          rouge1_f1: 1,
          rouge2_f1: 1,
          rougeL_f1: 1,
          bleu: 1,
          fk_grade: 8,
          confidence: 0.9,
          latency_ms: 5,
          semantic_similarity: null,
        },
      },
    })
    expect(parsed.type).toBe("progress")
    if (parsed.type === "progress") {
      expect(parsed.result.case_index).toBe(0)
    }
  })

  it("rejects a stream event with an unknown type", () => {
    expect(StreamEventSchema.safeParse({ type: "mystery" }).success).toBe(false)
  })
})
