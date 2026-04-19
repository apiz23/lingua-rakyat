"use client"

import { useState, useEffect, useRef } from "react"
import {
  getEvalReport,
  getSimplifyDemo,
  augmentQuery,
  runTestSuiteStream,
  clearEvalRecords,
  listDocuments,
  GROQ_MODELS,
  EvalReport,
  TestSuiteResult,
  SimplifyDemo,
  Document,
  StreamEvent,
} from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import PageIntro from "@/components/page-intro"
import {
  BarChart3,
  Zap,
  BookOpen,
  Globe,
  RefreshCw,
  Play,
  Trash2,
  Languages,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  FlaskConical,
  Clock,
  ShieldAlert,
} from "lucide-react"

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function score(value: number, decimals = 3) {
  return value.toFixed(decimals)
}

// ── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  color = "text-primary",
  bg = "bg-primary/5",
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  bg?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {label}
          </p>
          <p className={cn("mt-2 text-3xl font-bold tabular-nums", color)}>
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("rounded-lg p-2.5", bg)}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Grade Badge ────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: number }) {
  const color =
    grade <= 5
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : grade <= 7
        ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
        : "bg-orange-500/10 text-orange-600 border-orange-500/20"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        color
      )}
    >
      Grade {grade.toFixed(1)}
    </span>
  )
}

// ── Score Bar ──────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  max = 1,
}: {
  label: string
  value: number
  max?: number
}) {
  const pctVal = Math.min((value / max) * 100, 100)
  const color =
    pctVal >= 60
      ? "bg-emerald-500"
      : pctVal >= 35
        ? "bg-blue-500"
        : "bg-orange-400"
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {score(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            color
          )}
          style={{ width: `${pctVal}%` }}
        />
      </div>
    </div>
  )
}

// ── Language Table ─────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, { name: string; flag: string }> = {
  en: { name: "English", flag: "🇬🇧" },
  ms: { name: "Bahasa Melayu", flag: "🇲🇾" },
  id: { name: "Indonesian", flag: "🇮🇩" },
  "zh-cn": { name: "中文", flag: "🇨🇳" },
  tl: { name: "Tagalog", flag: "🇵🇭" },
  th: { name: "Thai", flag: "🇹🇭" },
  vi: { name: "Vietnamese", flag: "🇻🇳" },
  jv: { name: "Javanese", flag: "🇮🇩" },
  ceb: { name: "Cebuano", flag: "🇵🇭" },
}

// ── Category Labels ───────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  all: { label: "All", emoji: "📋" },
  housing: { label: "Housing", emoji: "🏠" },
  healthcare: { label: "Healthcare", emoji: "🏥" },
  student_loans: { label: "Student Loans", emoji: "🎓" },
  social_welfare: { label: "Welfare", emoji: "🤝" },
  immigration: { label: "Immigration", emoji: "🛂" },
}

// ── Rate Limit Banner ──────────────────────────────────────────────────────
function RateLimitBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="text-blue-800 dark:text-blue-200">
        <span className="font-medium">API Rate Limits active:</span> Chat is
        limited to <span className="font-mono font-medium">30 req/min</span>,
        uploads to <span className="font-mono font-medium">10 req/min</span> per
        IP. Returns HTTP 429 with{" "}
        <span className="font-mono font-medium">Retry-After</span> header.
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EvalPage() {
  const [report, setReport] = useState<EvalReport | null>(null)
  const [simplifyDemo, setSimplifyDemo] = useState<SimplifyDemo | null>(null)
  const [testResult, setTestResult] = useState<TestSuiteResult | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [augmentInput, setAugmentInput] = useState("")
  const [augmentLang, setAugmentLang] = useState("en")
  const [augmentResult, setAugmentResult] = useState<Record<
    string,
    string
  > | null>(null)

  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [loadingTest, setLoadingTest] = useState(false)
  const [loadingAugment, setLoadingAugment] = useState(false)
  const [expandedCases, setExpandedCases] = useState<Set<number>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [evalModel, setEvalModel] = useState("") // empty = server default (GROQ_MODEL_FAST)

  // Streaming progress state
  const [streamProgress, setStreamProgress] = useState<{
    completed: number
    total: number
    currentQuestion: string
    currentLang: string
    liveResults: TestSuiteResult["results"]
    errors: TestSuiteResult["errors"]
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [detectedCategory, setDetectedCategory] = useState<
    string | null | "unrelated"
  >(null)
  const [skippedReason, setSkippedReason] = useState<string | null>(null)

  // Load everything on mount
  useEffect(() => {
    fetchReport()
    fetchSimplifyDemo()
    fetchDocs()
  }, [])

  async function fetchReport() {
    setLoadingReport(true)
    try {
      const r = await getEvalReport()
      setReport(r)
    } catch {
      // no records yet is fine — backend returns status: no_data
    } finally {
      setLoadingReport(false)
    }
  }

  async function fetchSimplifyDemo() {
    setLoadingDemo(true)
    try {
      const d = await getSimplifyDemo()
      setSimplifyDemo(d)
    } catch {
      toast.error("Failed to load simplify demo")
    } finally {
      setLoadingDemo(false)
    }
  }

  async function fetchDocs() {
    try {
      const docs = await listDocuments()
      const ready = docs.filter((d) => d.status === "ready")
      setDocuments(ready)
      if (ready.length > 0) setSelectedDocId(ready[0].id)
    } catch {}
  }

  async function handleRunTestSuite() {
    if (!selectedDocId) {
      toast.error("Select a document first")
      return
    }

    // Abort any in-flight run
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const selectedDoc = documents.find((d) => d.id === selectedDocId)
    const docName = selectedDoc?.name ?? ""

    setLoadingTest(true)
    setTestResult(null)
    setSkippedReason(null)
    setDetectedCategory(null)
    setStreamProgress({
      completed: 0,
      total: 30,
      currentQuestion: "",
      currentLang: "en",
      liveResults: [],
      errors: [],
    })

    try {
      await runTestSuiteStream(
        selectedDocId,
        docName,
        evalModel,
        (event: StreamEvent) => {
          if (event.type === "category") {
            setDetectedCategory(event.category)
            setStreamProgress((prev) =>
              prev ? { ...prev, total: event.total } : prev
            )
          } else if (event.type === "skipped") {
            setSkippedReason(event.reason)
            setStreamProgress(null)
            setDetectedCategory("unrelated")
            toast.warning("Document not suitable for test suite", {
              description: event.reason,
              duration: 8000,
            })
          } else if (event.type === "progress") {
            setStreamProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: event.index + 1,
                    currentQuestion: event.result.question,
                    currentLang: event.result.language,
                    liveResults: [...prev.liveResults, event.result],
                  }
                : prev
            )
          } else if (event.type === "error") {
            setStreamProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: event.index + 1,
                    errors: [
                      ...prev.errors,
                      {
                        case_index: event.index,
                        question: "",
                        error: event.error,
                      },
                    ],
                  }
                : prev
            )
          } else if (event.type === "aggregate") {
            setTestResult({
              status: "ok",
              aggregate: event.aggregate,
              results: event.results,
              errors: event.errors,
            })
            setStreamProgress(null)
            fetchReport()
            toast.success(
              `Test suite complete — ROUGE-1: ${event.aggregate.avg_rouge1_f1.toFixed(3)}`
            )
          }
        },
        controller.signal
      )
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Test suite failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
      setStreamProgress(null)
    } finally {
      setLoadingTest(false)
    }
  }

  function handleCancelTest() {
    abortRef.current?.abort()
    setLoadingTest(false)
    setStreamProgress(null)
    toast.info("Test suite cancelled")
  }

  async function handleAugment() {
    if (!augmentInput.trim()) return
    setLoadingAugment(true)
    setAugmentResult(null)
    try {
      const r = await augmentQuery(augmentInput.trim(), augmentLang)
      setAugmentResult(r.variants)
    } catch (e) {
      toast.error("Augmentation failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setLoadingAugment(false)
    }
  }

  async function handleClear() {
    try {
      await clearEvalRecords()
      setReport(null)
      setTestResult(null)
      toast.success("Evaluation records cleared")
    } catch {
      toast.error("Failed to clear records")
    }
  }

  function toggleCase(idx: number) {
    setExpandedCases((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const hasMetrics =
    report && report.status === "ok" && report.total_queries > 0
  const hasGenerationQuality =
    hasMetrics && report.generation_quality !== undefined

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <PageIntro
          eyebrow="Validation Lab"
          title="Evaluation Dashboard"
          description="Track retrieval quality, latency, readability, and test-suite behavior from one standardized view without a page-specific header."
          icon={FlaskConical}
          actions={
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <button
                onClick={fetchReport}
                disabled={loadingReport}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loadingReport && "animate-spin")}
                />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleClear}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear</span>
              </button>
            </div>
          }
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Evaluation Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Lingua Rakyat · Model Performance & Validation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchReport}
                disabled={loadingReport}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loadingReport && "animate-spin")}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>
        </PageIntro>

        {/* Rate limit info */}
        <RateLimitBanner />

        {/* ── Section 1: Live Metrics ── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Live Performance Metrics</h2>
            {hasMetrics && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {report.total_queries} queries recorded
              </span>
            )}
          </div>

          {!hasMetrics ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
              <BarChart3 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">
                No metrics yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask questions in the workspace or run the test suite below to
                generate metrics.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Latency */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  <Clock className="h-4 w-4" /> Latency
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="p50 Latency"
                    value={`${report.latency.p50_ms}ms`}
                    sub="Median response time"
                    color="text-emerald-600"
                    bg="bg-emerald-500/5"
                    icon={Zap}
                  />
                  <MetricCard
                    label="p95 Latency"
                    value={`${report.latency.p95_ms}ms`}
                    sub="95th percentile"
                    color="text-blue-600"
                    bg="bg-blue-500/5"
                    icon={Zap}
                  />
                  <MetricCard
                    label="p99 Latency"
                    value={`${report.latency.p99_ms}ms`}
                    sub="99th percentile"
                    color="text-purple-600"
                    bg="bg-purple-500/5"
                    icon={Zap}
                  />
                  <MetricCard
                    label="Avg Latency"
                    value={`${report.latency.avg_ms}ms`}
                    sub="Mean response time"
                    icon={Clock}
                  />
                </div>
              </div>

              {/* Retrieval + Readability */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Avg Confidence"
                  value={pct(report.retrieval.avg_confidence)}
                  sub="Mean retrieval score"
                  color="text-primary"
                  icon={Sparkles}
                />
                <MetricCard
                  label="Above Threshold"
                  value={`${report.retrieval.pct_above_threshold}%`}
                  sub="Queries with conf ≥ 50%"
                  color="text-emerald-600"
                  bg="bg-emerald-500/5"
                  icon={CheckCircle}
                />
                <MetricCard
                  label="Avg Reading Grade"
                  value={report.readability.avg_fk_grade.toFixed(1)}
                  sub={`Target: ≤ grade ${report.readability.target_grade}`}
                  color={
                    report.readability.avg_fk_grade <= 6
                      ? "text-emerald-600"
                      : "text-orange-500"
                  }
                  bg={
                    report.readability.avg_fk_grade <= 6
                      ? "bg-emerald-500/5"
                      : "bg-orange-500/5"
                  }
                  icon={BookOpen}
                />
                <MetricCard
                  label="Simple Language"
                  value={`${report.readability.pct_simple_language}%`}
                  sub="Answers at grade ≤ 6"
                  color="text-blue-600"
                  bg="bg-blue-500/5"
                  icon={BookOpen}
                />
              </div>

              {/* Readability note */}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
                  report.readability.avg_fk_grade <= 6
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200"
                )}
              >
                {report.readability.avg_fk_grade <= 6 ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                {report.readability.note}
              </div>

              {/* ROUGE/BLEU scores */}
              {hasGenerationQuality && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    <BarChart3 className="h-4 w-4" /> Generation Quality (
                    {report.generation_quality!.samples_with_ground_truth}{" "}
                    graded samples)
                  </h3>
                  <div className="space-y-4 rounded-xl border border-border bg-card p-6">
                    <ScoreBar
                      label="ROUGE-1 F1 (unigram overlap)"
                      value={report.generation_quality!.avg_rouge1_f1}
                    />
                    <ScoreBar
                      label="ROUGE-2 F1 (bigram overlap)"
                      value={report.generation_quality!.avg_rouge2_f1}
                    />
                    <ScoreBar
                      label="ROUGE-L F1 (longest common subsequence)"
                      value={report.generation_quality!.avg_rougeL_f1}
                    />
                    <ScoreBar
                      label="BLEU Score (n-gram precision)"
                      value={report.generation_quality!.avg_bleu}
                    />
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-sm font-medium">
                        Exact Match Rate
                      </span>
                      <span className="font-mono text-sm text-muted-foreground tabular-nums">
                        {report.generation_quality!.exact_match_rate}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-language breakdown */}
              {Object.keys(report.per_language).length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    <Globe className="h-4 w-4" /> Per-Language Breakdown
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                            Language
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                            Queries
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                            Avg Confidence
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                            Avg Latency
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                            Readability
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {Object.entries(report.per_language).map(
                          ([lang, stats]) => {
                            const info = LANG_LABELS[lang] ?? {
                              name: lang,
                              flag: "🌐",
                            }
                            return (
                              <tr
                                key={lang}
                                className="transition-colors hover:bg-muted/20"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span>{info.flag}</span>
                                    <span className="font-medium">
                                      {info.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({lang})
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-muted-foreground">
                                  {stats.queries}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={cn(
                                      "font-mono tabular-nums",
                                      stats.avg_confidence >= 0.75
                                        ? "text-emerald-600"
                                        : stats.avg_confidence >= 0.5
                                          ? "text-blue-600"
                                          : "text-orange-500"
                                    )}
                                  >
                                    {pct(stats.avg_confidence)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-muted-foreground tabular-nums">
                                  {stats.avg_latency_ms}ms
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <GradeBadge grade={stats.avg_fk_grade} />
                                </td>
                              </tr>
                            )
                          }
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Section 2: Run Test Suite ── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Annotated Test Suite (ROUGE / BLEU)
            </h2>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <p className="mb-3 text-sm text-muted-foreground">
              Run the built-in{" "}
              <span className="font-medium text-foreground">
                30 annotated Q&A cases
              </span>{" "}
              against a document to get ROUGE-1/2/L and BLEU scores with ground
              truth comparison.
            </p>

            {/* Category breakdown pills */}
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { key: "housing", emoji: "🏠", label: "Housing", count: 9 },
                {
                  key: "student_loans",
                  emoji: "🎓",
                  label: "Student Loans",
                  count: 8,
                },
                {
                  key: "healthcare",
                  emoji: "🏥",
                  label: "Healthcare",
                  count: 7,
                },
                {
                  key: "social_welfare",
                  emoji: "🤝",
                  label: "Welfare",
                  count: 3,
                },
                {
                  key: "immigration",
                  emoji: "🛂",
                  label: "Immigration",
                  count: 2,
                },
              ].map((cat) => (
                <span
                  key={cat.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground"
                >
                  <span>{cat.emoji}</span>
                  <span className="font-medium text-foreground">
                    {cat.label}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                    {cat.count}
                  </span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                <span>🌐</span>
                <span>EN · MS · ZH-CN</span>
              </span>
            </div>

            {/* Detected category / unrelated warning */}
            {detectedCategory === "unrelated" && skippedReason && (
              <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-950">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                <div className="text-sm text-orange-800 dark:text-orange-200">
                  <p className="mb-1 font-medium">
                    Document not matched to any test category
                  </p>
                  <p className="text-xs opacity-90">
                    The test suite covers housing, healthcare, student loans,
                    welfare, and immigration. Upload a relevant government
                    services PDF — for example a housing policy, PTPTN guide, or
                    healthcare assistance document.
                  </p>
                </div>
              </div>
            )}
            {detectedCategory && detectedCategory !== "unrelated" && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-800 dark:bg-emerald-950">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-emerald-800 dark:text-emerald-200">
                  Detected category:{" "}
                  <span className="font-medium capitalize">
                    {detectedCategory.replace("_", " ")}
                  </span>
                  {streamProgress && (
                    <span className="ml-2 opacity-75">
                      — running {streamProgress.total} matching cases
                    </span>
                  )}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                disabled={loadingTest}
                className="w-full flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
              >
                {documents.length === 0 ? (
                  <option value="">No documents ready</option>
                ) : (
                  documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))
                )}
              </select>
              {/* Model selector for eval */}
              <select
                value={evalModel}
                onChange={(e) => setEvalModel(e.target.value)}
                disabled={loadingTest}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50 sm:w-72"
                title="Model to use for test suite"
              >
                <option value="">Auto (qwen3-32b default)</option>
                {GROQ_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.tag}
                  </option>
                ))}
              </select>
              {loadingTest ? (
                <button
                  onClick={handleCancelTest}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 sm:w-auto sm:justify-start"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancel
                </button>
              ) : (
                <button
                  onClick={handleRunTestSuite}
                  disabled={!selectedDocId}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:justify-start"
                >
                  <Play className="h-4 w-4" />
                  Run Test Suite
                </button>
              )}
            </div>

            {/* ── Live streaming progress ── */}
            {streamProgress && (
              <div className="mt-5 space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      Running test suite…
                    </span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {streamProgress.completed} / {streamProgress.total}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${Math.round((streamProgress.completed / streamProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {streamProgress.currentQuestion ? (
                      <>
                        Testing:{" "}
                        <span className="italic">
                          &ldquo;{streamProgress.currentQuestion.slice(0, 70)}
                          &rdquo;
                        </span>
                      </>
                    ) : (
                      "Starting…"
                    )}
                  </p>
                </div>

                {/* Live results grid — appears as cases complete */}
                {streamProgress.liveResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Completed so far:
                    </p>
                    <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {streamProgress.liveResults.map((r, i) => {
                        const LANG: Record<string, string> = {
                          en: "🇬🇧",
                          ms: "🇲🇾",
                          "zh-cn": "🇨🇳",
                          id: "🇮🇩",
                          tl: "🇵🇭",
                        }
                        const CAT: Record<string, string> = {
                          housing: "🏠",
                          healthcare: "🏥",
                          student_loans: "🎓",
                          social_welfare: "🤝",
                          immigration: "🛂",
                        }
                        const r1 = r.scores.rouge1_f1
                        const barColor =
                          r1 >= 0.4
                            ? "bg-emerald-500"
                            : r1 >= 0.2
                              ? "bg-blue-500"
                              : "bg-orange-400"
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
                          >
                            <span className="shrink-0 text-sm">
                              {LANG[r.language] ?? "🌐"}
                            </span>
                            <span className="shrink-0">
                              {CAT[r.category ?? ""] ?? "📄"}
                            </span>
                            <span className="flex-1 truncate text-foreground/80">
                              {r.question}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              {/* Mini ROUGE-1 bar */}
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{
                                    width: `${Math.min(r1 * 200, 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="w-10 text-right font-mono text-muted-foreground tabular-nums">
                                {r1.toFixed(3)}
                              </span>
                              <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Test results */}
            {testResult && (
              <div className="mt-6 space-y-5">
                {/* Aggregate */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-primary">
                      Aggregate Results — {testResult.aggregate.cases_run} cases
                      {testResult.aggregate.cases_failed > 0 && (
                        <span className="ml-2 text-sm font-normal text-orange-500">
                          ({testResult.aggregate.cases_failed} failed)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      {
                        label: "ROUGE-1",
                        value: testResult.aggregate.avg_rouge1_f1,
                      },
                      {
                        label: "ROUGE-2",
                        value: testResult.aggregate.avg_rouge2_f1,
                      },
                      {
                        label: "ROUGE-L",
                        value: testResult.aggregate.avg_rougeL_f1,
                      },
                      { label: "BLEU", value: testResult.aggregate.avg_bleu },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-md border border-border/50 bg-card p-3 text-center"
                      >
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
                          {value.toFixed(3)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">Avg Grade: </span>
                      <GradeBadge grade={testResult.aggregate.avg_fk_grade} />
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Avg Confidence:{" "}
                      </span>
                      <span className="font-medium">
                        {pct(testResult.aggregate.avg_confidence)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Avg Latency:{" "}
                      </span>
                      <span className="font-mono font-medium">
                        {testResult.aggregate.avg_latency_ms}ms
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {testResult.aggregate.readability_note}
                  </p>
                </div>

                {/* Category filter tabs */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORY_LABELS).map(([key, val]) => {
                    const count =
                      key === "all"
                        ? testResult.results.length
                        : testResult.results.filter(
                            (r) => r.category === key
                          ).length
                    if (key !== "all" && count === 0) return null
                    return (
                      <button
                        key={key}
                        onClick={() => setCategoryFilter(key)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                          categoryFilter === key
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        <span>{val.emoji}</span>
                        {val.label}
                        <span className="rounded-full bg-muted px-1.5 text-[10px]">
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Failed cases warning */}
                {testResult.errors.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-950">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                    <div className="text-sm text-orange-800 dark:text-orange-200">
                      <span className="font-medium">
                        {testResult.errors.length} case(s) failed:
                      </span>{" "}
                      {testResult.errors
                        .map((e) => e.question.slice(0, 40))
                        .join(", ")}
                    </div>
                  </div>
                )}

                {/* Per-case details */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Per-case results
                    {categoryFilter !== "all"
                      ? ` — ${CATEGORY_LABELS[categoryFilter]?.label}`
                      : ""}
                    :
                  </p>
                  {testResult.results
                    .filter(
                      (r) =>
                        categoryFilter === "all" ||
                        r.category === categoryFilter
                    )
                    .map((r, i) => {
                      const isOpen = expandedCases.has(i)
                      const info = LANG_LABELS[r.language] ?? {
                        name: r.language,
                        flag: "🌐",
                      }
                      const catInfo = CATEGORY_LABELS[r.category ?? ""] ?? {
                        emoji: "📄",
                        label: r.category ?? "",
                      }
                      return (
                        <div
                          key={i}
                          className="overflow-hidden rounded-lg border border-border"
                        >
                          <button
                            onClick={() => toggleCase(i)}
                            className="flex w-full items-center justify-between bg-card px-4 py-3 text-left hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm">{info.flag}</span>
                              <span className="hidden items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
                                {catInfo.emoji} {catInfo.label}
                              </span>
                              <span className="line-clamp-1 max-w-xs text-sm font-medium">
                                {r.question}
                              </span>
                            </div>
                            <div className="ml-4 flex shrink-0 items-center gap-3">
                              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                R1: {r.scores.rouge1_f1.toFixed(3)}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                BLEU: {r.scores.bleu.toFixed(3)}
                              </span>
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="space-y-4 border-t border-border bg-muted/10 p-4">
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {[
                                  {
                                    label: "ROUGE-1",
                                    value: r.scores.rouge1_f1,
                                  },
                                  {
                                    label: "ROUGE-2",
                                    value: r.scores.rouge2_f1,
                                  },
                                  {
                                    label: "ROUGE-L",
                                    value: r.scores.rougeL_f1,
                                  },
                                  { label: "BLEU", value: r.scores.bleu },
                                ].map(({ label, value }) => (
                                  <div
                                    key={label}
                                    className="rounded-md border border-border/50 bg-card p-2 text-center"
                                  >
                                    <p className="text-[10px] text-muted-foreground">
                                      {label}
                                    </p>
                                    <p className="text-base font-bold tabular-nums">
                                      {value.toFixed(3)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              <div className="grid gap-3 text-xs sm:grid-cols-2">
                                <div>
                                  <p className="mb-1 font-medium text-muted-foreground">
                                    Answer:
                                  </p>
                                  <p className="rounded border border-border/50 bg-card p-2 leading-relaxed text-foreground/80">
                                    {r.answer}
                                  </p>
                                </div>
                                <div>
                                  <p className="mb-1 font-medium text-muted-foreground">
                                    Ground Truth:
                                  </p>
                                  <p className="rounded border border-emerald-200 bg-emerald-50 p-2 leading-relaxed text-foreground/80 dark:border-emerald-800 dark:bg-emerald-950">
                                    {r.ground_truth}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                <span>
                                  Grade:{" "}
                                  <GradeBadge grade={r.scores.fk_grade} />
                                </span>
                                <span>
                                  Confidence: {pct(r.scores.confidence)}
                                </span>
                                <span>Latency: {r.scores.latency_ms}ms</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 3: Jargon Simplification Demo ── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Text Simplification Demo</h2>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="mb-5 text-sm text-muted-foreground">
              Bureaucratic and legal language is automatically simplified into
              plain language before answers are shown to users.
            </p>
            {loadingDemo ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : simplifyDemo ? (
              <div className="space-y-4">
                {simplifyDemo.examples.map((ex, i) => {
                  const info = LANG_LABELS[ex.language] ?? {
                    name: ex.language,
                    flag: "🌐",
                  }
                  return (
                    <div
                      key={i}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-2 bg-muted/30 px-4 py-2">
                        <span className="text-sm">{info.flag}</span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {info.name}
                        </span>
                      </div>
                      <div className="grid gap-0 sm:grid-cols-2">
                        <div className="border-b border-border p-4 sm:border-r sm:border-b-0">
                          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-orange-500 uppercase">
                            Before — Official Language
                          </p>
                          <p className="text-sm leading-relaxed text-foreground/70">
                            {ex.original}
                          </p>
                        </div>
                        <div className="bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
                          <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-emerald-600 uppercase">
                            After — Plain Language
                          </p>
                          <p className="text-sm leading-relaxed font-medium text-foreground">
                            {ex.simplified}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Failed to load examples.
              </p>
            )}
          </div>
        </section>

        {/* ── Section 4: Cross-lingual Query Augmentation ── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Cross-Lingual Query Augmentation
            </h2>
          </div>
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Enter a question to see it automatically translated into all
              supported SEA languages. This demonstrates dialect-aware
              cross-lingual retrieval capability.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={augmentLang}
                onChange={(e) => setAugmentLang(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none sm:w-56"
              >
                <option value="en">🇬🇧 English</option>
                <option value="ms">🇲🇾 Malay</option>
                <option value="zh-cn">🇨🇳 Chinese</option>
              </select>
              <input
                type="text"
                value={augmentInput}
                onChange={(e) => setAugmentInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAugment()}
                placeholder="How do I apply for housing aid?"
                className="w-full flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <button
                onClick={handleAugment}
                disabled={loadingAugment || !augmentInput.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
              >
                {loadingAugment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                Expand
              </button>
            </div>

            {augmentResult && (
              <div className="mt-2 space-y-2">
                {Object.entries(augmentResult).map(([lang, text]) => {
                  const isParaphrase = lang.startsWith("paraphrase_")
                  const baseLang = lang.replace("paraphrase_", "")
                  const info = LANG_LABELS[baseLang] ?? {
                    name: baseLang,
                    flag: "🌐",
                  }
                  return (
                    <div
                      key={lang}
                      className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <span className="shrink-0 text-lg">{info.flag}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                          {isParaphrase
                            ? `${info.name} — Simplified`
                            : info.name}
                        </p>
                        <p className="mt-0.5 text-sm text-foreground">{text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
