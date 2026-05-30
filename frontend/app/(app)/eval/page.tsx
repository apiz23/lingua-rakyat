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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Layers,
  FlaskConical,
  Clock,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react"

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%` }
function fmt3(v: number) { return v.toFixed(3) }

type Tone = "success" | "warning" | "primary" | "default"

function toneFor(ratio: number): Tone {
  return ratio >= 0.65 ? "success" : ratio >= 0.35 ? "primary" : "warning"
}

const ACCENT: Record<Tone, string> = {
  success: "border-l-success text-success",
  warning: "border-l-warning text-warning",
  primary: "border-l-primary text-primary",
  default: "border-l-border text-foreground",
}

// ── StatCard ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, tone = "default", icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: Tone
  icon?: React.ComponentType<{ className?: string }>
}) {
  const [borderCls, valueCls] = ACCENT[tone].split(" ")
  return (
    <div className={cn("border border-border border-l-[3px] bg-card p-4 transition-colors hover:border-primary/20", borderCls)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
          <p className={cn("mt-1.5 font-heading text-2xl font-bold tabular-nums", valueCls)}>{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        {Icon && <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", valueCls)} />}
      </div>
    </div>
  )
}

// ── SegBar — 10-cell segmented bar ────────────────────────────────────────

const SEG_COLOR: Record<Tone, string> = {
  success: "bg-success",
  primary: "bg-primary",
  warning: "bg-warning",
  default: "bg-primary",
}

function SegBar({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const ratio = Math.min(value / max, 1)
  const filled = Math.round(ratio * 10)
  const tone = toneFor(ratio)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground/70">{fmt3(value)}</span>
      </div>
      <div aria-hidden className="flex gap-[3px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-[1px]", i < filled ? SEG_COLOR[tone] : "bg-muted")} />
        ))}
      </div>
    </div>
  )
}

// ── GradeBadge ─────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: number }) {
  return (
    <span className={cn(
      "inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold",
      grade <= 5
        ? "border-success/20 bg-success/10 text-success"
        : grade <= 7
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-warning/20 bg-warning/10 text-warning"
    )}>
      G{grade.toFixed(1)}
    </span>
  )
}

// ── Category Labels ───────────────────────────────────────────────────────

const LANG_LABELS: Record<string, { name: string; code: string }> = {
  en: { name: "English", code: "EN" },
  ms: { name: "Bahasa Melayu", code: "MS" },
  id: { name: "Indonesian", code: "ID" },
  "zh-cn": { name: "中文", code: "ZH" },
  tl: { name: "Tagalog", code: "TL" },
  th: { name: "Thai", code: "TH" },
  vi: { name: "Vietnamese", code: "VI" },
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  identity: "MyKad / Identity",
  passport: "Passport",
}

// ── Tab config ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "metrics" as const,   label: "Live Metrics",    icon: BarChart3 },
  { id: "testsuite" as const, label: "Test Suite",      icon: Play },
  { id: "simplify" as const,  label: "Simplification",  icon: BookOpen },
  { id: "augment" as const,   label: "Augmentation",    icon: Languages },
]
type TabId = typeof TABS[number]["id"]

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EvalPage() {
  const [report, setReport]               = useState<EvalReport | null>(null)
  const [simplifyDemo, setSimplifyDemo]   = useState<SimplifyDemo | null>(null)
  const [testResult, setTestResult]       = useState<TestSuiteResult | null>(null)
  const [documents, setDocuments]         = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [augmentInput, setAugmentInput]   = useState("")
  const [augmentLang, setAugmentLang]     = useState("en")
  const [augmentResult, setAugmentResult] = useState<Record<string, string> | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingDemo, setLoadingDemo]     = useState(false)
  const [loadingTest, setLoadingTest]     = useState(false)
  const [loadingAugment, setLoadingAugment] = useState(false)
  const [expandedCases, setExpandedCases] = useState<Set<number>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [evalModel, setEvalModel]         = useState("")
  const [activeTab, setActiveTab]         = useState<TabId>("metrics")
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [streamProgress, setStreamProgress] = useState<{
    completed: number; total: number; currentQuestion: string
    currentLang: string; liveResults: TestSuiteResult["results"]; errors: TestSuiteResult["errors"]
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [detectedCategory, setDetectedCategory] = useState<string | null | "unrelated">(null)
  const [skippedReason, setSkippedReason]  = useState<string | null>(null)

  useEffect(() => { fetchReport(); fetchSimplifyDemo(); fetchDocs() }, [])

  async function fetchReport() {
    setLoadingReport(true)
    try { setReport(await getEvalReport()) } catch { /* no records yet */ } finally { setLoadingReport(false) }
  }

  async function fetchSimplifyDemo() {
    setLoadingDemo(true)
    try { setSimplifyDemo(await getSimplifyDemo()) }
    catch { toast.error("Failed to load simplify demo") }
    finally { setLoadingDemo(false) }
  }

  async function fetchDocs() {
    try {
      const docs = (await listDocuments()).filter(d => d.status === "ready")
      setDocuments(docs)
      if (docs.length > 0) setSelectedDocId(docs[0].id)
    } catch {}
  }

  async function handleRunTestSuite() {
    if (!selectedDocId) { toast.error("Select a document first"); return }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const docName = documents.find(d => d.id === selectedDocId)?.name ?? ""

    setLoadingTest(true)
    setTestResult(null)
    setSkippedReason(null)
    setDetectedCategory(null)
    setStreamProgress({ completed: 0, total: 0, currentQuestion: "", currentLang: "en", liveResults: [], errors: [] })
    setActiveTab("testsuite")

    try {
      await runTestSuiteStream(selectedDocId, docName, evalModel, (event: StreamEvent) => {
        if (event.type === "category") {
          setDetectedCategory(event.category)
          setStreamProgress(prev => prev ? { ...prev, total: event.total } : prev)
        } else if (event.type === "skipped") {
          setSkippedReason(event.reason)
          setStreamProgress(null)
          setDetectedCategory("unrelated")
          toast.warning("Document not suitable for test suite", { description: event.reason, duration: 8000 })
        } else if (event.type === "progress") {
          setStreamProgress(prev => prev ? {
            ...prev, completed: event.index + 1, currentQuestion: event.result.question,
            currentLang: event.result.language, liveResults: [...prev.liveResults, event.result],
          } : prev)
        } else if (event.type === "error") {
          setStreamProgress(prev => prev ? {
            ...prev, completed: event.index + 1,
            errors: [...prev.errors, { case_index: event.index, question: "", error: event.error }],
          } : prev)
        } else if (event.type === "aggregate") {
          setTestResult({ status: "ok", aggregate: event.aggregate, results: event.results, errors: event.errors })
          setStreamProgress(null)
          fetchReport()
          toast.success(`Test suite complete — ROUGE-1: ${event.aggregate.avg_rouge1_f1.toFixed(3)}`)
        }
      }, controller.signal)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Test suite failed", { description: e instanceof Error ? e.message : "Unknown error" })
      setStreamProgress(null)
    } finally { setLoadingTest(false) }
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
    try { setAugmentResult((await augmentQuery(augmentInput.trim(), augmentLang)).variants) }
    catch (e) { toast.error("Augmentation failed", { description: e instanceof Error ? e.message : "Unknown error" }) }
    finally { setLoadingAugment(false) }
  }

  async function handleClear() {
    try { await clearEvalRecords(); setReport(null); setTestResult(null); toast.success("Evaluation records cleared") }
    catch { toast.error("Failed to clear records") }
  }

  function toggleCase(idx: number) {
    setExpandedCases(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }

  const hasMetrics = report?.status === "ok" && (report.total_queries ?? 0) > 0
  const hasGenQuality = hasMetrics && report!.generation_quality !== undefined

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header + tabs ── */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/98 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* Top row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2.5">
              <FlaskConical className="h-4 w-4 text-primary" />
              <h1 className="font-heading text-base font-semibold text-foreground sm:text-lg">
                Evaluation Dashboard
              </h1>
              {hasMetrics && (
                <Badge variant="secondary" className="h-auto px-2 py-0.5 text-[10px]">
                  {report!.total_queries} queries
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button onClick={fetchReport} disabled={loadingReport} variant="outline" size="sm" className="h-8 gap-1.5 px-2.5">
                <RefreshCw className={cn("h-3.5 w-3.5", loadingReport && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button onClick={handleClear} variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="-mb-px flex gap-0 overflow-x-auto scrollbar-none" role="tablist">
            {TABS.map(tab => {
              const active = activeTab === tab.id
              const showSpinner = tab.id === "testsuite" && loadingTest
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:px-4 sm:text-sm",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {showSpinner
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <tab.icon className="h-3.5 w-3.5" />
                  }
                  {tab.label}
                  {tab.id === "testsuite" && streamProgress && (
                    <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* ── Rate limit banner (dismissible) ── */}
      {!bannerDismissed && (
        <div className="border-b border-border bg-muted/30">
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 sm:px-6">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="flex-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Rate limits active</span> — all routes limited per IP.
              For demo day set <span className="font-mono">BOOTH_MODE=true</span> on the backend.
            </p>
            <button onClick={() => setBannerDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">

        {/* ════════════════════════════════════
            TAB 1 — LIVE METRICS
        ════════════════════════════════════ */}
        <div className={cn(activeTab !== "metrics" && "hidden")}>
          {!hasMetrics ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border py-24 text-center">
              <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
              <p className="font-medium text-foreground">No metrics recorded yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Ask questions in the workspace or run the test suite to generate data.
              </p>
              <Button
                onClick={() => setActiveTab("testsuite")}
                variant="outline"
                size="sm"
                className="mt-5 gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                Go to Test Suite
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Latency row */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Latency</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label="p50" value={`${report!.latency.p50_ms}ms`} sub="Median" tone="success" icon={Zap} />
                  <StatCard label="p95" value={`${report!.latency.p95_ms}ms`} sub="95th pct" tone="primary" icon={Zap} />
                  <StatCard label="p99" value={`${report!.latency.p99_ms}ms`} sub="99th pct" icon={Zap} />
                  <StatCard label="Average" value={`${report!.latency.avg_ms}ms`} sub="Mean" icon={Clock} />
                </div>
              </section>

              {/* Retrieval + readability */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Retrieval &amp; Readability</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="Avg Confidence"
                    value={pct(report!.retrieval.avg_confidence)}
                    sub="Mean retrieval score"
                    tone={toneFor(report!.retrieval.avg_confidence)}
                    icon={Sparkles}
                  />
                  <StatCard
                    label="Above Threshold"
                    value={`${report!.retrieval.pct_above_threshold}%`}
                    sub="Conf ≥ 50%"
                    tone={report!.retrieval.pct_above_threshold >= 60 ? "success" : "warning"}
                    icon={CheckCircle}
                  />
                  <StatCard
                    label="Avg Reading Grade"
                    value={report!.readability.avg_fk_grade.toFixed(1)}
                    sub={`Target ≤ ${report!.readability.target_grade}`}
                    tone={report!.readability.avg_fk_grade <= 6 ? "success" : "warning"}
                    icon={BookOpen}
                  />
                  <StatCard
                    label="Simple Language"
                    value={`${report!.readability.pct_simple_language}%`}
                    sub="Answers at grade ≤ 6"
                    tone={report!.readability.pct_simple_language >= 60 ? "success" : "primary"}
                    icon={BookOpen}
                  />
                </div>
              </section>

              {/* Faithfulness */}
              {(report!.faithfulness?.scored_queries ?? 0) > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Answer Faithfulness</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                      label="Faithfulness Score"
                      value={fmt3(report!.faithfulness!.avg_faithfulness_score)}
                      sub={`${report!.faithfulness!.scored_queries} queries scored`}
                      tone={toneFor(report!.faithfulness!.avg_faithfulness_score)}
                      icon={ShieldCheck}
                    />
                  </div>
                </section>
              )}

              {/* Readability note */}
              <div className={cn(
                "flex items-center gap-2 border px-4 py-3 text-sm",
                report!.readability.avg_fk_grade <= 6
                  ? "border-success/20 bg-success/5 text-success"
                  : "border-border bg-muted/30 text-muted-foreground"
              )}>
                {report!.readability.avg_fk_grade <= 6
                  ? <CheckCircle className="h-4 w-4 shrink-0" />
                  : <AlertCircle className="h-4 w-4 shrink-0" />
                }
                <span className="text-xs">{report!.readability.note}</span>
              </div>

              {/* ROUGE / BLEU quality */}
              {hasGenQuality && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Generation Quality
                    </h2>
                    <span className="text-[10px] text-muted-foreground">
                      {report!.generation_quality!.samples_with_ground_truth} graded samples
                    </span>
                  </div>
                  <div className="border border-border bg-card p-5 space-y-3.5">
                    <SegBar label="ROUGE-1 F1 — unigram overlap" value={report!.generation_quality!.avg_rouge1_f1} max={0.5} />
                    <SegBar label="ROUGE-2 F1 — bigram overlap" value={report!.generation_quality!.avg_rouge2_f1} max={0.3} />
                    <SegBar label="ROUGE-L F1 — longest common subsequence" value={report!.generation_quality!.avg_rougeL_f1} max={0.4} />
                    <SegBar label="BLEU — n-gram precision" value={report!.generation_quality!.avg_bleu} max={0.3} />
                    {(report!.faithfulness?.scored_queries ?? 0) > 0 && (
                      <SegBar label="Faithfulness — answer grounded in sources" value={report!.faithfulness!.avg_faithfulness_score} />
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-[11px] font-medium text-muted-foreground">Exact Match Rate</span>
                      <span className="font-mono text-xs tabular-nums text-foreground">
                        {report!.generation_quality!.exact_match_rate}%
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Per-language breakdown */}
              {Object.keys(report!.per_language).length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Per-Language Breakdown
                    </h2>
                  </div>
                  <div className="border border-border">
                    <ScrollArea className="w-full whitespace-nowrap">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            {["Language", "Queries", "Avg Confidence", "Avg Latency", "Readability"].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase first:text-left last:text-right [&:not(:first-child)]:text-right">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {Object.entries(report!.per_language).map(([lang, stats]) => {
                            const info = LANG_LABELS[lang] ?? { name: lang, code: lang.toUpperCase() }
                            const confTone = toneFor(stats.avg_confidence)
                            const confCls = confTone === "success" ? "text-success" : confTone === "primary" ? "text-primary" : "text-warning"
                            return (
                              <tr key={lang} className="transition-colors hover:bg-muted/20">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{info.code}</span>
                                    <span className="text-sm font-medium">{info.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground tabular-nums">{stats.queries}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={cn("font-mono text-sm font-semibold tabular-nums", confCls)}>{pct(stats.avg_confidence)}</span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground tabular-nums">{stats.avg_latency_ms}ms</td>
                                <td className="px-4 py-3 text-right"><GradeBadge grade={stats.avg_fk_grade} /></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════
            TAB 2 — TEST SUITE
        ════════════════════════════════════ */}
        <div className={cn("space-y-6", activeTab !== "testsuite" && "hidden")}>
          <div className="border border-border bg-card p-5 sm:p-6">
            {/* Controls row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                value={selectedDocId || "__none__"}
                onValueChange={v => setSelectedDocId(v === "__none__" ? "" : v)}
                disabled={loadingTest || documents.length === 0}
              >
                <SelectTrigger className="min-w-0 flex-1 text-sm">
                  <SelectValue placeholder={documents.length === 0 ? "No ready documents" : "Select document"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__none__">{documents.length === 0 ? "No ready documents" : "Select document"}</SelectItem>
                    {documents.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={evalModel || "__auto__"} onValueChange={v => setEvalModel(v === "__auto__" ? "" : v)} disabled={loadingTest}>
                <SelectTrigger className="w-full text-sm text-muted-foreground sm:w-60">
                  <SelectValue placeholder="Auto (server fast model)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__auto__">Auto (server fast model)</SelectItem>
                    {GROQ_MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.label} — {m.tag}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {loadingTest ? (
                <Button onClick={handleCancelTest} variant="destructive" className="shrink-0 gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cancel
                </Button>
              ) : (
                <Button onClick={handleRunTestSuite} disabled={!selectedDocId} className="shrink-0 gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  Run Test Suite
                </Button>
              )}
            </div>

            {/* Category pills */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {[
                { key: "identity", label: "MyKad / Identity", count: 5 },
                { key: "passport", label: "Passport", count: 6 },
              ].map(cat => (
                <span key={cat.key} className="inline-flex items-center gap-1.5 border border-border bg-muted/30 px-2.5 py-1 text-muted-foreground">
                  <span className="font-medium text-foreground">{cat.label}</span>
                  <span className="bg-muted px-1 py-0.5 font-mono text-[10px] tabular-nums">{cat.count}</span>
                </span>
              ))}
              <span className="border border-border bg-muted/30 px-2.5 py-1 text-muted-foreground">EN · MS · ZH</span>
            </div>

            {/* Category / unrelated status */}
            {detectedCategory === "unrelated" && skippedReason && (
              <div className="mt-4 flex items-start gap-3 border border-border bg-muted/20 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Document not matched to any test category</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    The built-in suite covers the shipped MyKad FAQ and Malaysian passport guideline documents.
                    Select one of those or update the annotated test cases.
                  </p>
                </div>
              </div>
            )}
            {detectedCategory && detectedCategory !== "unrelated" && (
              <div className="mt-4 flex items-center gap-2 border border-success/20 bg-success/5 px-4 py-2.5">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                <span className="text-sm text-success">
                  Matched: <span className="font-medium capitalize">{detectedCategory.replace("_", " ")}</span>
                  {streamProgress && <span className="ml-2 opacity-75">— running {streamProgress.total} cases</span>}
                </span>
              </div>
            )}
          </div>

          {/* Streaming progress */}
          {streamProgress && (
            <div className="border border-border bg-card p-5">
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Running test suite…</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {streamProgress.completed} / {streamProgress.total}
                  </span>
                </div>
                <div className="flex gap-[3px]" aria-hidden>
                  {Array.from({ length: 10 }).map((_, i) => {
                    const threshold = streamProgress.total > 0 ? (i + 1) / 10 : 0
                    const filled = streamProgress.total > 0
                      ? streamProgress.completed / Math.max(1, streamProgress.total) > threshold * (9 / 10)
                      : false
                    return <span key={i} className={cn("h-2 flex-1 rounded-[1px] transition-all duration-500", filled ? "bg-primary" : "bg-muted")} />
                  })}
                </div>
                {streamProgress.currentQuestion && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    Testing: <em>&ldquo;{streamProgress.currentQuestion.slice(0, 80)}&rdquo;</em>
                  </p>
                )}
              </div>

              {streamProgress.liveResults.length > 0 && (
                <div className="divide-y divide-border border border-border">
                  {streamProgress.liveResults.map((r, i) => {
                    const r1 = r.scores.rouge1_f1
                    const filled = Math.min(Math.round((r1 / 0.5) * 10), 10)
                    const barTone = r1 >= 0.3 ? "bg-success" : r1 >= 0.15 ? "bg-primary" : "bg-warning"
                    const info = LANG_LABELS[r.language] ?? { code: r.language.toUpperCase() }
                    return (
                      <div key={i} className="flex items-center gap-3 bg-card px-3 py-2 text-xs">
                        <span className="shrink-0 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{info.code}</span>
                        <span className="flex-1 truncate text-foreground/80">{r.question}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <div className="flex w-12 gap-[2px]" aria-hidden>
                            {Array.from({ length: 10 }).map((_, j) => (
                              <span key={j} className={cn("h-1 flex-1 rounded-[1px]", j < filled ? barTone : "bg-muted")} />
                            ))}
                          </div>
                          <span className="w-9 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{r1.toFixed(3)}</span>
                          <CheckCircle className="h-3 w-3 shrink-0 text-success" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Test results */}
          {testResult && (
            <div className="space-y-4">
              {/* Aggregate */}
              <div className="border border-success/20 bg-success/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="font-semibold text-success">
                    {testResult.aggregate.cases_run} cases complete
                    {testResult.aggregate.cases_failed > 0 && (
                      <span className="ml-2 text-sm font-normal text-warning">({testResult.aggregate.cases_failed} failed)</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "ROUGE-1", value: testResult.aggregate.avg_rouge1_f1 },
                    { label: "ROUGE-2", value: testResult.aggregate.avg_rouge2_f1 },
                    { label: "ROUGE-L", value: testResult.aggregate.avg_rougeL_f1 },
                    { label: "BLEU",    value: testResult.aggregate.avg_bleu },
                  ].map(({ label, value }) => (
                    <div key={label} className="border border-border/50 bg-card p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="mt-0.5 font-heading text-xl font-bold tabular-nums">{value.toFixed(3)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Grade: <GradeBadge grade={testResult.aggregate.avg_fk_grade} /></span>
                  <span>Confidence: <strong className="text-foreground">{pct(testResult.aggregate.avg_confidence)}</strong></span>
                  <span>Latency: <strong className="font-mono text-foreground">{testResult.aggregate.avg_latency_ms}ms</strong></span>
                  {testResult.aggregate.avg_semantic_similarity != null && (
                    <span>Semantic Sim: <strong className="font-mono text-foreground">{testResult.aggregate.avg_semantic_similarity.toFixed(3)}</strong></span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{testResult.aggregate.readability_note}</p>
              </div>

              {/* Category filter */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                  const count = key === "all" ? testResult.results.length : testResult.results.filter(r => r.category === key).length
                  if (key !== "all" && count === 0) return null
                  return (
                    <button
                      key={key}
                      onClick={() => setCategoryFilter(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 border px-3 py-1 text-xs font-medium transition-colors",
                        categoryFilter === key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      )}
                    >
                      {label}
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] tabular-nums", categoryFilter === key ? "bg-primary/20" : "bg-muted")}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Per-case accordion */}
              <div className="space-y-1.5">
                {testResult.results
                  .filter(r => categoryFilter === "all" || r.category === categoryFilter)
                  .map((r, i) => {
                    const isOpen = expandedCases.has(i)
                    const info = LANG_LABELS[r.language] ?? { name: r.language, code: r.language.toUpperCase() }
                    const catLabel = CATEGORY_LABELS[r.category ?? ""] ?? r.category ?? ""
                    const r1Tone = toneFor(r.scores.rouge1_f1 / 0.4)
                    const r1Cls = r1Tone === "success" ? "text-success" : r1Tone === "primary" ? "text-primary" : "text-warning"
                    return (
                      <div key={i} className="border border-border">
                        <button
                          onClick={() => toggleCase(i)}
                          className="flex w-full items-center gap-3 bg-card/60 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
                        >
                          <span className="shrink-0 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{info.code}</span>
                          <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">{catLabel}</span>
                          <span className="flex-1 truncate font-medium">{r.question}</span>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className={cn("font-mono text-xs tabular-nums", r1Cls)}>R1 {r.scores.rouge1_f1.toFixed(3)}</span>
                            <GradeBadge grade={r.scores.fk_grade} />
                            {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="space-y-4 border-t border-border bg-muted/10 p-4">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {[
                                { label: "ROUGE-1", value: r.scores.rouge1_f1 },
                                { label: "ROUGE-2", value: r.scores.rouge2_f1 },
                                { label: "ROUGE-L", value: r.scores.rougeL_f1 },
                                { label: "BLEU",    value: r.scores.bleu },
                              ].map(({ label, value }) => (
                                <div key={label} className="border border-border/50 bg-card p-2.5 text-center">
                                  <p className="text-[10px] text-muted-foreground">{label}</p>
                                  <p className="mt-0.5 font-mono text-base font-bold tabular-nums">{value.toFixed(3)}</p>
                                </div>
                              ))}
                            </div>
                            <div className="grid gap-3 text-xs sm:grid-cols-2">
                              <div>
                                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Answer</p>
                                <p className="border border-border bg-card p-3 text-xs leading-relaxed text-foreground/80">{r.answer}</p>
                              </div>
                              <div>
                                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-success uppercase">Ground Truth</p>
                                <p className="border border-success/20 bg-success/5 p-3 text-xs leading-relaxed text-foreground/80">{r.ground_truth}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>Confidence: <strong className="text-foreground">{pct(r.scores.confidence)}</strong></span>
                              <span>Latency: <strong className="font-mono text-foreground">{r.scores.latency_ms}ms</strong></span>
                              {r.scores.semantic_similarity != null && (
                                <span>Semantic Sim: <strong className="font-mono text-foreground">{r.scores.semantic_similarity.toFixed(3)}</strong></span>
                              )}
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

        {/* ════════════════════════════════════
            TAB 3 — SIMPLIFICATION
        ════════════════════════════════════ */}
        <div className={cn(activeTab !== "simplify" && "hidden")}>
          <p className="mb-5 text-sm text-muted-foreground">
            Bureaucratic language is simplified into plain language before answers are shown to users.
          </p>
          {loadingDemo ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading examples…</span>
            </div>
          ) : simplifyDemo ? (
            <div className="space-y-4">
              {simplifyDemo.examples.map((ex, i) => {
                const info = LANG_LABELS[ex.language] ?? { name: ex.language, code: ex.language.toUpperCase() }
                return (
                  <div key={i} className="border border-border">
                    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
                      <span className="bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{info.code}</span>
                      <span className="text-xs font-medium text-muted-foreground">{info.name}</span>
                    </div>
                    <div className="grid gap-0 sm:grid-cols-2">
                      <div className="border-b border-border p-4 sm:border-r sm:border-b-0">
                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-warning uppercase">Before — Official Language</p>
                        <p className="text-sm leading-relaxed text-foreground/70">{ex.original}</p>
                      </div>
                      <div className="bg-success/5 p-4">
                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-success uppercase">After — Plain Language</p>
                        <p className="text-sm leading-relaxed font-medium text-foreground">{ex.simplified}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">Failed to load examples.</p>
          )}
        </div>

        {/* ════════════════════════════════════
            TAB 4 — AUGMENTATION
        ════════════════════════════════════ */}
        <div className={cn(activeTab !== "augment" && "hidden")}>
          <p className="mb-5 text-sm text-muted-foreground">
            Enter a question to see it expanded into cross-lingual variants for multilingual retrieval.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={augmentLang} onValueChange={setAugmentLang}>
              <SelectTrigger className="w-full text-sm sm:w-44">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ms">Malay</SelectItem>
                  <SelectItem value="zh-cn">Chinese</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Input
              value={augmentInput}
              onChange={e => setAugmentInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAugment()}
              placeholder="What documents are required for a first-time passport application?"
              className="h-10 flex-1 text-sm"
            />
            <Button onClick={handleAugment} disabled={loadingAugment || !augmentInput.trim()} className="shrink-0 gap-1.5">
              {loadingAugment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
              Expand
            </Button>
          </div>

          {augmentResult && (
            <div className="mt-4 divide-y divide-border border border-border">
              {Object.entries(augmentResult).map(([lang, text]) => {
                const isParaphrase = lang.startsWith("paraphrase_")
                const baseLang = lang.replace("paraphrase_", "")
                const info = LANG_LABELS[baseLang] ?? { name: baseLang, code: baseLang.toUpperCase() }
                return (
                  <div key={lang} className="flex items-start gap-3 bg-card px-4 py-3">
                    <span className="shrink-0 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{info.code}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        {isParaphrase ? `${info.name} — Simplified` : info.name}
                      </p>
                      <p className="mt-0.5 text-sm text-foreground">{text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
