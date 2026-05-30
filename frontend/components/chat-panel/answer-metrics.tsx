"use client"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// AnswerMetrics — two thin segmented meters (confidence + grounded) shown
// below a completed answer. Reuses the eval-page ScoreBar aesthetic: flat,
// civic, zero AI-tell. Accessible: the visible % text is the value.
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

function MetricBar({
  label,
  value,
  title,
}: {
  label: string
  value: number
  title?: string
}) {
  const pct = Math.round(value * 100)
  const tone = toneFor(value)
  const filled = Math.round(value * SEGMENTS)

  return (
    <div className="space-y-1" title={title}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
          {label}
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

export function AnswerMetrics({
  confidence,
  faithfulness,
  language,
}: {
  confidence: number
  faithfulness?: number | null
  language: string
}) {
  const ms = language === "ms"
  const hasFaithfulness = typeof faithfulness === "number" && faithfulness > 0
  if (confidence <= 0 && !hasFaithfulness) return null

  return (
    <div className="mt-3 max-w-sm space-y-2.5">
      {confidence > 0 ? (
        <MetricBar
          label={ms ? "Keyakinan" : "Confidence"}
          value={confidence}
          title={
            ms
              ? "Keyakinan capaian — sejauh mana petikan sumber sepadan dengan soalan"
              : "Retrieval confidence — how well the sources match the question"
          }
        />
      ) : null}
      {hasFaithfulness ? (
        <MetricBar
          label={ms ? "Berdasar sumber" : "Grounded"}
          value={faithfulness as number}
          title={
            ms
              ? "Sejauh mana jawapan ini berasaskan petikan sumber"
              : "How well this answer is grounded in the source excerpts"
          }
        />
      ) : null}
    </div>
  )
}
