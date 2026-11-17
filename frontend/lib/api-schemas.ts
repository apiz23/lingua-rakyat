import { z } from "zod"

export const ConfidenceLabelSchema = z.enum(["high", "medium", "low"])

export type ConfidenceLabel = z.infer<typeof ConfidenceLabelSchema>

export function isConfidenceLabel(value: unknown): value is ConfidenceLabel {
  return ConfidenceLabelSchema.safeParse(value).success
}

export const ClaimVerificationStatusSchema = z.enum([
  "supported",
  "partially_supported",
  "unsupported",
  "conflicting",
  "unverifiable",
])

export const VerificationStatusSchema = z.enum([
  "verified",
  "partially_supported",
  "unsupported",
  "conflicting",
  "unverifiable",
])

export const SourceChunkSchema = z.object({
  text: z.string(),
  document_id: z.string(),
  source_id: z.string().optional(),
  score: z.number(),
  doc_name: z.string().optional(),
  page_start: z.number().nullable().optional(),
  page_end: z.number().nullable().optional(),
  section_title: z.string().optional(),
  vector_score: z.number().optional(),
  rerank_score: z.number().optional(),
  confidence_label: ConfidenceLabelSchema.optional(),
})

export const AnswerVerificationSchema = z.object({
  verification_status: VerificationStatusSchema,
  claims: z.array(
    z.object({
      claim_id: z.string(),
      text: z.string(),
      status: ClaimVerificationStatusSchema,
      supporting_source_ids: z.array(z.string()),
      conflicting_source_ids: z.array(z.string()),
    })
  ),
  verified_claim_count: z.number(),
  partially_supported_claim_count: z.number(),
  unsupported_claim_count: z.number(),
  conflicting_claim_count: z.number(),
  unverifiable_claim_count: z.number(),
  verification_summary: z.string(),
  citation_valid: z.boolean(),
  extraction_complete: z.boolean(),
  extraction_status: z.string(),
  revision_attempted: z.boolean(),
  abstained: z.boolean(),
})

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size_bytes: z.number(),
  chunk_count: z.number(),
  status: z.enum(["processing", "ready", "error"]),
  uploaded_at: z.string(),
  error_message: z.string().optional(),
  storage_path: z.string().optional(),
  public_url: z.string().optional(),
  is_featured: z.boolean().optional(),
  agency: z.string().optional(),
})

export const DocumentStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["processing", "ready", "error"]),
  chunk_count: z.number(),
  error_message: z.string().nullable().optional(),
})

export const AskResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(SourceChunkSchema),
  language: z.string(),
  question: z.string(),
  timestamp: z.string(),
  confidence: z.number(),
  confidence_label: ConfidenceLabelSchema.optional(),
  latency_ms: z.number(),
  model_used: z.string().optional(),
  retrieval_mode: z.string().optional(),
  query_variants_used: z.array(z.string()).optional(),
  top_query_variant: z.string().optional(),
  sufficient_evidence: z.boolean().optional(),
  faithfulness: z.number().nullable().optional(),
  evidence_mode: z.string().optional(),
  confidence_explanation: z.string().nullable().optional(),
  verification: AnswerVerificationSchema.nullable().optional(),
})

export const ChatHistoryMessageSchema = z.object({
  id: z.string(),
  user_id: z.string().optional(),
  session_id: z.string(),
  document_id: z.string(),
  question: z.string(),
  answer: z.string(),
  language: z.string(),
  sources: z.array(SourceChunkSchema),
  timestamp: z.string(),
  confidence: z.number(),
  confidence_label: ConfidenceLabelSchema.optional(),
  latency_ms: z.number(),
  model_used: z.string().optional(),
  sufficient_evidence: z.boolean().optional(),
  faithfulness: z.number().nullable().optional(),
  confidence_explanation: z.string().nullable().optional(),
  verification: AnswerVerificationSchema.nullable().optional(),
})

export const EvalReportSchema = z.object({
  status: z.string(),
  generated_at: z.string(),
  total_queries: z.number(),
  latency: z.object({
    p50_ms: z.number(),
    p95_ms: z.number(),
    p99_ms: z.number(),
    avg_ms: z.number(),
  }),
  retrieval: z.object({
    avg_confidence: z.number(),
    pct_above_threshold: z.number(),
  }),
  readability: z.object({
    avg_fk_grade: z.number(),
    pct_simple_language: z.number(),
    target_grade: z.number(),
    note: z.string(),
  }),
  per_language: z.record(
    z.string(),
    z.object({
      queries: z.number(),
      avg_confidence: z.number(),
      avg_latency_ms: z.number(),
      avg_fk_grade: z.number(),
    })
  ),
  generation_quality: z
    .object({
      samples_with_ground_truth: z.number(),
      avg_rouge1_f1: z.number(),
      avg_rouge2_f1: z.number(),
      avg_rougeL_f1: z.number(),
      avg_bleu: z.number(),
      exact_match_rate: z.number(),
    })
    .optional(),
  faithfulness: z
    .object({
      scored_queries: z.number(),
      avg_faithfulness_score: z.number(),
    })
    .optional(),
})

export const TestCaseResultSchema = z.object({
  case_index: z.number(),
  language: z.string(),
  category: z.string().optional(),
  question: z.string(),
  answer: z.string(),
  ground_truth: z.string(),
  scores: z.object({
    rouge1_f1: z.number(),
    rouge2_f1: z.number(),
    rougeL_f1: z.number(),
    bleu: z.number(),
    fk_grade: z.number(),
    confidence: z.number(),
    latency_ms: z.number(),
    semantic_similarity: z.number().nullable(),
  }),
})

export const TestSuiteAggregateSchema = z.object({
  cases_run: z.number(),
  cases_failed: z.number(),
  avg_rouge1_f1: z.number(),
  avg_rouge2_f1: z.number(),
  avg_rougeL_f1: z.number(),
  avg_bleu: z.number(),
  avg_fk_grade: z.number(),
  avg_confidence: z.number(),
  avg_latency_ms: z.number(),
  readability_note: z.string(),
  avg_semantic_similarity: z.number().nullable(),
})

export const TestSuiteErrorSchema = z.object({
  case_index: z.number(),
  question: z.string(),
  error: z.string(),
})

export const TestSuiteResultSchema = z.object({
  status: z.string(),
  aggregate: TestSuiteAggregateSchema,
  results: z.array(TestCaseResultSchema),
  errors: z.array(TestSuiteErrorSchema),
})

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    index: z.number(),
    total: z.number(),
    result: TestCaseResultSchema,
  }),
  z.object({
    type: z.literal("aggregate"),
    aggregate: TestSuiteAggregateSchema,
    results: z.array(TestCaseResultSchema),
    errors: z.array(TestSuiteErrorSchema),
  }),
  z.object({
    type: z.literal("error"),
    index: z.number(),
    error: z.string(),
  }),
  z.object({ type: z.literal("done") }),
  z.object({
    type: z.literal("skipped"),
    reason: z.string(),
    detected_category: z.string().nullable(),
  }),
  z.object({
    type: z.literal("category"),
    category: z.string(),
    total: z.number(),
  }),
])

export const SimplifyDemoSchema = z.object({
  description: z.string(),
  examples: z.array(
    z.object({
      original: z.string(),
      simplified: z.string(),
      language: z.string(),
    })
  ),
})

export const AugmentResultSchema = z.object({
  original: z.string(),
  source_lang: z.string(),
  variants: z.record(z.string(), z.string()),
  variant_count: z.number(),
})

export const ClearHistoryResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  deleted_rows: z.number(),
})

export const ConversationSummarySchema = z.object({
  session_id: z.string(),
  title: z.string(),
  last_at: z.string(),
  count: z.number(),
  custom_title: z.string().optional(),
})

export const ShareResultSchema = z.object({
  slug: z.string(),
  url: z.string(),
})

export const SharedAnswerSchema = z.object({
  slug: z.string(),
  question: z.string(),
  answer: z.string(),
  sources: z.array(SourceChunkSchema),
  language: z.string(),
  created_at: z.string(),
  confidence: z.number(),
  confidence_label: z.string(),
  agency: z.string(),
  evidence_linked: z.boolean(),
})

export const MyShareSchema = z.object({
  slug: z.string(),
  question: z.string(),
  confidence_label: z.string(),
  agency: z.string(),
  created_at: z.string(),
})
