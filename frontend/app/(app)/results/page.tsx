"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  AlertCircle,
  Globe2,
  BookOpen,
  Target,
  ShieldCheck,
  MessageSquare,
  FolderOpen,
  FlaskConical,
  BarChart3,
  ArrowRight,
  Loader2,
  Zap,
  Mic,
} from "lucide-react"
import { getEvalReport, type EvalReport } from "@/lib/api"

function pct(v: number) { return `${Math.round(v * 100)}%` }

function MetricCard({
  title, value, description, icon, live = false,
}: {
  title: string; value: string; description: string
  icon: React.ReactNode; live?: boolean
}) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {icon} {title}
        {live && (
          <span className="ml-auto inline-flex items-center gap-1 border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9px] font-semibold text-success">
            LIVE
          </span>
        )}
      </p>
      <div className="mb-1 font-heading text-2xl font-bold text-foreground">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function ComplianceRow({
  title, description, status, variant = "success",
}: {
  title: string; description: string; status: string; variant?: "success" | "warning"
}) {
  return (
    <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <span className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 text-xs font-medium",
        variant === "success"
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border bg-muted/30 text-muted-foreground"
      )}>
        {variant === "success" && <CheckCircle2 className="h-3 w-3" />}
        {variant === "warning" && <AlertCircle className="h-3 w-3" />}
        {status}
      </span>
    </div>
  )
}

export default function ResultsPage() {
  const [report, setReport] = useState<EvalReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEvalReport()
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasMetrics = report?.status === "ok" && (report.total_queries ?? 0) > 0

  // Live or fallback display values
  const rougeVal = hasMetrics && report!.generation_quality
    ? report!.generation_quality.avg_rouge1_f1.toFixed(3)
    : "Run benchmark →"
  const bleuVal = hasMetrics && report!.generation_quality
    ? report!.generation_quality.avg_bleu.toFixed(3)
    : "Run benchmark →"
  const readabilityVal = hasMetrics
    ? `${report!.readability.avg_fk_grade.toFixed(1)} (target ≤ 6)`
    : "Target ≤ 6"
  const confidenceVal = hasMetrics
    ? `${pct(report!.retrieval.avg_confidence)} (target ≥ 50%)`
    : "Target ≥ 50%"
  const faithfulnessVal = hasMetrics && (report!.faithfulness?.scored_queries ?? 0) > 0
    ? `${pct(report!.faithfulness!.avg_faithfulness_score)} (${report!.faithfulness!.scored_queries} scored)`
    : "Ask questions to score →"
  const latencyVal = hasMetrics
    ? `p50 ${report!.latency.p50_ms}ms · p95 ${report!.latency.p95_ms}ms`
    : "Target < 3s"

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* Header */}
      <div className="mb-10">
        <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          Lingua Rakyat · RISE 2026
        </p>
        <h1 className="mb-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          Project Showcase
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Democratizing Access to Government Services Through Multilingual AI.
          Live metrics pull from the evaluation backend in real time.
        </p>
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading live metrics…
          </div>
        )}
        {!loading && hasMetrics && (
          <div className="mt-3 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Live — {report!.total_queries} queries recorded
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        <div className="border border-primary/20 bg-primary/5 p-5">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-semibold text-foreground">Workspace</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Upload a PDF and ask questions in Malay, English, or Chinese.</p>
          <Button asChild className="w-full">
            <Link href="/workspace">Open Workspace <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-semibold text-foreground">Documents</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Upload, rename, or delete government PDF documents.</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/manage">Manage Documents <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-semibold text-foreground">Evaluation</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Run ROUGE/BLEU test suite and view live benchmark scores.</p>
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/eval">Evaluation Dashboard <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/benchmark">Benchmark Lab <BarChart3 className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* Live quality metrics */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        Quality Metrics
      </p>
      <h2 className="mb-5 flex items-center font-heading text-2xl font-semibold text-foreground">
        <Target className="mr-2 h-5 w-5 text-primary" />
        Live Performance Metrics
      </h2>
      <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="ROUGE-1 F1" value={rougeVal} description="Word overlap vs ground truth answers. Normal RAG range: 0.10–0.30." icon={<BookOpen className="h-4 w-4" />} live={hasMetrics && !!report!.generation_quality} />
        <MetricCard title="BLEU Score" value={bleuVal} description="N-gram precision vs reference answers." icon={<Globe2 className="h-4 w-4" />} live={hasMetrics && !!report!.generation_quality} />
        <MetricCard title="Readability" value={readabilityVal} description="Flesch-Kincaid grade level. Lower = easier to read." icon={<BookOpen className="h-4 w-4" />} live={hasMetrics} />
        <MetricCard title="Retrieval Confidence" value={confidenceVal} description="Mean reranked score across all queries." icon={<ShieldCheck className="h-4 w-4" />} live={hasMetrics} />
        <MetricCard title="Faithfulness" value={faithfulnessVal} description="How grounded answers are in the source document (Cohere reranker)." icon={<ShieldCheck className="h-4 w-4" />} live={hasMetrics && (report!.faithfulness?.scored_queries ?? 0) > 0} />
        <MetricCard title="Latency" value={latencyVal} description="End-to-end response latency (retrieval + reranking + generation)." icon={<Zap className="h-4 w-4" />} live={hasMetrics} />
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* Feature checklist */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        Feature Checklist
      </p>
      <h2 className="mb-5 flex items-center font-heading text-2xl font-semibold text-foreground">
        <CheckCircle2 className="mr-2 h-5 w-5 text-primary" />
        System Capabilities
      </h2>
      <div className="mb-10 border border-border bg-card">
        <div className="divide-y divide-border">
          <ComplianceRow title="Multilingual RAG" description="Cohere embed-multilingual-v3 — retrieval at embedding level, not via translation. EN / MS / ZH." status="FULFILLED" />
          <ComplianceRow title="Neural Reranking" description="Cohere rerank-multilingual-v3 cross-encoder re-scores top-k chunks before generation." status="FULFILLED" />
          <ComplianceRow title="Multi-Query Augmentation" description="Question expanded to ×4 language variants before retrieval to improve cross-lingual recall." status="FULFILLED" />
          <ComplianceRow title="Evidence Guard (anti-hallucination)" description="Refuses to generate when retrieved evidence is below the confidence threshold." status="FULFILLED" />
          <ComplianceRow title="Faithfulness Scoring" description="Per-answer grounding score (Cohere reranker: answer vs source chunks). Shown in chat UI." status="FULFILLED" />
          <ComplianceRow title="Section-Aware Chunking" description="360-word chunks with 45-word overlap; detects section headers to preserve document structure." status="FULFILLED" />
          <ComplianceRow title="Voice I/O" description="Groq Whisper STT for voice input. ElevenLabs TTS + browser speechSynthesis fallback for audio output." status="FULFILLED" />
          <ComplianceRow title="Multi-Turn Context" description="Last 3 Q&A turns passed as context so follow-up questions (e.g. 'tell me more') work correctly." status="FULFILLED" />
          <ComplianceRow title="Suggested Follow-ups" description="After each answer, 3 contextual follow-up questions are suggested and clickable." status="FULFILLED" />
          <ComplianceRow title="PDF Viewer + Citation Linking" description="Click any source pill → highlights the passage in the in-app PDF panel." status="FULFILLED" />
          <ComplianceRow title="Evaluation Dashboard" description="ROUGE-1/2/L, BLEU, Flesch-Kincaid, faithfulness — streamed live from annotated test suite." status="FULFILLED" />
          <ComplianceRow title="Rate Limiting + BOOTH_MODE" description="SlowAPI per-IP rate limiting. BOOTH_MODE=true lifts limits for shared WiFi demo." status="FULFILLED" />
          <ComplianceRow title="Accessibility (Atkinson Hyperlegible)" description="Body font designed for low-vision users. Voice I/O for audio-first access." status="FULFILLED" />
          <ComplianceRow title="Offline Fallback Cache" description="Prior Q&A excerpts cached in localStorage; auto-triggers when network is unavailable." status="FULFILLED" />
        </div>
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* SDG Impact */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        Social Impact
      </p>
      <h2 className="mb-5 flex items-center font-heading text-2xl font-semibold text-foreground">
        <Globe2 className="mr-2 h-5 w-5 text-primary" />
        SDG Alignment
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { sdg: "16", label: "Peace, Justice & Strong Institutions", desc: "Transparent, verifiable government information for every citizen regardless of language, background, or literacy level." },
          { sdg: "10", label: "Reduced Inequalities", desc: "Multilingual access removes barriers for Malay, Chinese, and English speakers in a single unified platform." },
          { sdg: "4",  label: "Quality Education", desc: "Empowers citizens to understand legal rights, entitlements, and civic obligations through grounded, plain-language answers." },
        ].map(({ sdg, label, desc }) => (
          <div key={sdg} className="border border-primary/20 bg-primary/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-primary/30 bg-primary text-primary-foreground">
                <span className="font-heading text-xl font-black">{sdg}</span>
              </div>
              <p className="text-xs font-semibold text-primary">{label}</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-6 border border-border bg-card p-6 sm:grid-cols-4">
        {[
          { value: "33M+", label: "Malaysians addressable" },
          { value: "3", label: "Languages supported" },
          { value: "$0", label: "Cost to citizens" },
          { value: "≤ 6th", label: "Reading level target" },
        ].map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="font-heading text-3xl font-bold text-primary">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
