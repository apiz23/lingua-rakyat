export type SourceChunk = {
  text: string;
  document_id: string;
  source_id?: string;
  score: number;
  doc_name?: string;
  page_start?: number | null;
  page_end?: number | null;
  section_title?: string;
  vector_score?: number;
  rerank_score?: number;
  confidence_label?: "high" | "medium" | "low";
};

export type AnswerVerification = {
  verification_status:
    | "verified"
    | "partially_supported"
    | "unsupported"
    | "conflicting"
    | "unverifiable";
};

export type ChatStreamEvent =
  | { type: "start" }
  | {
      type: "retrieval";
      language: string;
      retrieval_mode: string;
      query_variants_used: string[];
      top_query_variant: string;
      sufficient_evidence?: boolean;
    }
  | { type: "verifying" }
  | { type: "token"; text: string }
  | { type: "sources"; sources: SourceChunk[] }
  | {
      type: "complete";
      answer: string;
      language: string;
      sources: SourceChunk[];
      confidence: number;
      confidence_label?: "high" | "medium" | "low";
      latency_ms: number;
      model_used: string;
      sufficient_evidence: boolean;
      evidence_mode?: string;
      cached: boolean;
      retrieval_mode?: string;
      query_variants_used?: string[];
      top_query_variant?: string;
      faithfulness?: number | null;
      confidence_explanation?: string | null;
      verification?: AnswerVerification | null;
    }
  | { type: "suggestions"; questions: string[] }
  | { type: "error"; detail: string };
