"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SourceChunk } from "@/lib/api"

// ---------------------------------------------------------------------------
// AnswerMetrics — segmented bars (confidence + grounded) + expandable
// "How calculated?" breakdown panel.
// ---------------------------------------------------------------------------

const SEGMENTS = 10

type Tone = "success" | "primary" | "warning"

function toneFor(value: number): Tone {
  if (value >= 0.75) return "success"
  if (value >= 0.5) return "primary"
  return "warning"
}

const FILLED_CLASS: Record<Tone, string> = {
  success: "bg-success",
  primary: "bg-primary",
  warning: "bg-warning",
}

function MetricBar({ label, value, tooltip }: { label: string; value: number; tooltip?: string }) {
  const pct = Math.round(value * 100)
  const tone = toneFor(value)
  const filled = Math.round(value * SEGMENTS)

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate text-[11px] font-medium text-muted-foreground">
          {label}
          {tooltip && (
            <span title={tooltip} className="shrink-0 cursor-help">
              <Info
                className="h-2.5 w-2.5 text-muted-foreground/40 hover:text-muted-foreground/70"
                aria-label={tooltip}
              />
            </span>
          )}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground/70">
          {pct}%
        </span>
      </div>
      <div aria-hidden="true" className="flex items-center gap-[3px]">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-[1px] transition-colors",
              i < filled ? FILLED_CLASS[tone] : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  )
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`
}

interface BreakdownProps {
  confidence: number
  faithfulness: number | null | undefined
  sources: SourceChunk[]
  language: string
}

function Breakdown({ confidence, faithfulness, sources, language }: BreakdownProps) {
  const ms = language === "ms"
  const topSources = [...sources]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)

  const hasFaithfulness = typeof faithfulness === "number" && faithfulness > 0

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3 text-[10px] leading-relaxed text-muted-foreground">

      {/* Confidence section */}
      <div className="space-y-1.5">
        <p className="font-semibold text-foreground/80 uppercase tracking-wider text-[9px]">
          {ms ? "Keyakinan" : "Confidence"} — {pct(confidence)}
        </p>
        <p>
          {ms
            ? "Skor tertinggi daripada semua sumber yang ditemui. Formula: (kesamaan vektor × 35%) + (penilaian semula Cohere × 65%)"
            : "Highest score across all retrieved sources. Formula: (vector similarity × 35%) + (Cohere rerank × 65%)"}
        </p>

        {topSources.length > 0 && (
          <div className="mt-1.5 space-y-1">
            <p className="font-medium text-foreground/60">
              {ms ? "Skor teratas:" : "Top source scores:"}
            </p>
            {topSources.map((src, i) => {
              const v = src.vector_score ?? 0
              const r = src.rerank_score ?? 0
              const combined = src.score ?? 0
              const name = src.doc_name
                ? src.doc_name.replace(/\.pdf$/i, "")
                : ms ? `Sumber ${i + 1}` : `Source ${i + 1}`
              const page = src.page_start ? ` p.${src.page_start}` : ""
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className="shrink-0 font-mono text-foreground/50">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-foreground/60">{name}{page}</span>
                    <span className="ml-1.5 font-semibold tabular-nums text-foreground/80">
                      {pct(combined)}
                    </span>
                    {(v > 0 || r > 0) && (
                      <span className="ml-1 text-muted-foreground/60">
                        ({ms ? "vektor" : "vec"} {pct(v)} + {ms ? "semantik" : "rerank"} {pct(r)})
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Faithfulness section */}
      {hasFaithfulness && (
        <div className="space-y-1 border-t border-border/40 pt-3">
          <p className="font-semibold text-foreground/80 uppercase tracking-wider text-[9px]">
            {ms ? "Berdasar Sumber" : "Grounded"} — {pct(faithfulness as number)}
          </p>
          <p>
            {ms
              ? "Cohere menguji: adakah setiap kenyataan dalam jawapan disokong oleh petikan sumber? Jawapan digunakan sebagai pertanyaan; sumber sebagai dokumen. Skor tinggi = jawapan kekal dalam kandungan sumber."
              : "Cohere reranker run in reverse: the answer is used as the query, source chunks as documents. Measures how well every claim in the answer stays within the source text. High = fully grounded, no hallucination."}
          </p>
        </div>
      )}
    </div>
  )
}

export function AnswerMetrics({
  confidence,
  faithfulness,
  language,
  confidenceReason,
  sources = [],
}: {
  confidence: number
  faithfulness?: number | null
  language: string
  confidenceReason?: string
  sources?: SourceChunk[]
}) {
  const ms = language === "ms"
  const hasFaithfulness = typeof faithfulness === "number" && faithfulness > 0
  const [open, setOpen] = useState(false)

  if (confidence <= 0 && !hasFaithfulness) return null

  return (
    <div className="mt-3 max-w-sm space-y-2.5">
      {confidence > 0 && (
        <MetricBar
          label={ms ? "Keyakinan" : "Confidence"}
          value={confidence}
          tooltip={
            ms
              ? "Kualiti padanan sumber. Formula: kesamaan vektor × 35% + Cohere rerank × 65%"
              : "Source match quality. Formula: vector similarity × 35% + Cohere rerank × 65%"
          }
        />
      )}
      {hasFaithfulness && (
        <MetricBar
          label={ms ? "Berdasar sumber" : "Grounded"}
          value={faithfulness as number}
          tooltip={
            ms
              ? "Setiap kenyataan dalam jawapan disokong petikan sumber. Tinggi = tiada halusinasi."
              : "Answer stays within source text. High = every claim is backed by retrieved passages, no hallucination."
          }
        />
      )}
      {confidenceReason && (
        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          {confidenceReason}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:outline-none"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {ms ? "Bagaimana dikira?" : "How calculated?"}
      </button>

      {open && (
        <Breakdown
          confidence={confidence}
          faithfulness={faithfulness}
          sources={sources}
          language={language}
        />
      )}
    </div>
  )
}
