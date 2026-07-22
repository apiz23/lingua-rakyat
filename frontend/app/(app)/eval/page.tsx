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
  ShieldCheck,
  X,
  Info,
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
      Grade {grade.toFixed(1)}
    </span>
  )
}

// ── InfoNote ── plain-language callout box ─────────────────────────────────

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border border-border/40 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
      <span>{children}</span>
    </div>
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
  { id: "metrics"   as const, label: "Live Stats",            icon: BarChart3  },
  { id: "testsuite" as const, label: "Answer Accuracy Test",  icon: Play       },
  { id: "simplify"  as const, label: "Language Simplification", icon: BookOpen },
  { id: "augment"   as const, label: "Multilingual Expansion", icon: Languages },
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
          toast.success(`Test complete — Keyword Match: ${event.aggregate.avg_rouge1_f1.toFixed(3)}`)
        }
      }, controller.signal)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Test failed", { description: e instanceof Error ? e.message : "Unknown error" })
      setStreamProgress(null)
    } finally { setLoadingTest(false) }
  }

  function handleCancelTest() {
    abortRef.current?.abort()
    setLoadingTest(false)
    setStreamProgress(null)
    toast.info("Test cancelled")
  }

  async function handleAugment() {
    if (!augmentInput.trim()) return
    setLoadingAugment(true)
    setAugmentResult(null)
    try { setAugmentResult((await augmentQuery(augmentInput.trim(), augmentLang)).variants) }
    catch (e) { toast.error("Expansion failed", { description: e instanceof Error ? e.message : "Unknown error" }) }
    finally { setLoadingAugment(false) }
  }

  async function handleClear() {
    const token = window.prompt("Enter admin token to clear evaluation records:")
    if (!token) return
    try { await clearEvalRecords(token); setReport(null); setTestResult(null); toast.success("Records cleared") }
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
              <div>
                <h1 className="font-heading text-base font-semibold text-foreground sm:text-lg">
                  AI Quality Dashboard
                </h1>
              </div>
              {hasMetrics && (
                <Badge variant="secondary" className="h-auto px-2 py-0.5 text-[10px]">
                  {report!.total_queries} questions tested
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

      {/* ── Info banner (dismissible) ── */}
      {!bannerDismissed && (
        <div className="border-b border-border bg-muted/30">
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 sm:px-6">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="flex-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">For evaluators &amp; judges only</span> — this page is not linked publicly. It shows how accurately and reliably the AI answers questions.
            </p>
            <button onClick={() => setBannerDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">

        {/* ════════════════════════════════════
            TAB 1 — LIVE STATS
        ════════════════════════════════════ */}
        <div className={cn(activeTab !== "metrics" && "hidden")}>
          {!hasMetrics ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border py-24 text-center">
              <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
              <p className="font-medium text-foreground">No data recorded yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Ask questions in the workspace or run an accuracy test to generate data.
              </p>
              <Button
                onClick={() => setActiveTab("testsuite")}
                variant="outline"
                size="sm"
                className="mt-5 gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                Run Accuracy Test
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Response Speed */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Response Speed</h2>
                </div>
                <InfoNote>How fast the AI responds. Lower is better. Most users experience the &ldquo;Typical&rdquo; speed.</InfoNote>
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label="Typical Speed" value={`${report!.latency.p50_ms}ms`} sub="Half of answers arrive within this time" tone="success" icon={Zap} />
                  <StatCard label="Fast Majority" value={`${report!.latency.p95_ms}ms`} sub="95% of answers arrive within this time" tone="primary" icon={Zap} />
                  <StatCard label="Slowest 1%" value={`${report!.latency.p99_ms}ms`} sub="Worst-case response time" icon={Zap} />
                  <StatCard label="Average Speed" value={`${report!.latency.avg_ms}ms`} sub="Mean response time across all queries" icon={Clock} />
                </div>
              </section>

              {/* Search Accuracy & Language Quality */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Search Accuracy &amp; Language Quality</h2>
                </div>
                <InfoNote>How well the AI found the right information, and how easy the answers are to read.</InfoNote>
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="Search Accuracy"
                    value={pct(report!.retrieval.avg_confidence)}
                    sub="How confident the AI is that it found the right section of the document"
                    tone={toneFor(report!.retrieval.avg_confidence)}
                    icon={Sparkles}
                  />
                  <StatCard
                    label="High-Confidence Answers"
                    value={`${report!.retrieval.pct_above_threshold}%`}
                    sub="Percentage of answers where the AI found a strong match"
                    tone={report!.retrieval.pct_above_threshold >= 60 ? "success" : "warning"}
                    icon={CheckCircle}
                  />
                  <StatCard
                    label="Reading Level"
                    value={report!.readability.avg_fk_grade.toFixed(1)}
                    sub={`School grade equivalent — target is grade ${report!.readability.target_grade} or below (easy to read)`}
                    tone={report!.readability.avg_fk_grade <= 6 ? "success" : "warning"}
                    icon={BookOpen}
                  />
                  <StatCard
                    label="Easy-to-Read Answers"
                    value={`${report!.readability.pct_simple_language}%`}
                    sub="Answers written at an everyday reading level (grade 6 or below)"
                    tone={report!.readability.pct_simple_language >= 60 ? "success" : "primary"}
                    icon={BookOpen}
                  />
                </div>
              </section>

              {/* Answer Truthfulness */}
              {(report!.faithfulness?.scored_queries ?? 0) > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Answer Truthfulness</h2>
                  </div>
                  <InfoNote>Measures whether the AI&apos;s answer is supported by the actual document — not made up.</InfoNote>
                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                      label="Truthfulness Score"
                      value={fmt3(report!.faithfulness!.avg_faithfulness_score)}
                      sub={`${report!.faithfulness!.scored_queries} answers checked against source — closer to 1.0 = more accurate`}
                      tone={toneFor(report!.faithfulness!.avg_faithfulness_score)}
                      icon={ShieldCheck}
                    />
                  </div>
                </section>
              )}

              {/* Readability status note */}
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

              {/* Answer Quality (ROUGE / BLEU) */}
              {hasGenQuality && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Answer Quality
                    </h2>
                    <span className="text-[10px] text-muted-foreground">
                      {report!.generation_quality!.samples_with_ground_truth} answers compared against expected answers
                    </span>
                  </div>
                  <InfoNote>
                    The AI&apos;s answers are compared word-by-word against expert-written expected answers.
                    Each bar shows how closely they match — higher is better.
                  </InfoNote>
                  <div className="mt-3 border border-border bg-card p-5 space-y-3.5">
                    <SegBar label="Keyword Match — how many individual words the AI got right" value={report!.generation_quality!.avg_rouge1_f1} max={0.5} />
                    <SegBar label="Phrase Match — how many two-word phrases the AI got right" value={report!.generation_quality!.avg_rouge2_f1} max={0.3} />
                    <SegBar label="Answer Flow — how naturally the answer reads compared to the expected answer" value={report!.generation_quality!.avg_rougeL_f1} max={0.4} />
                    <SegBar label="Overall Accuracy — combined answer quality score" value={report!.generation_quality!.avg_bleu} max={0.3} />
                    {(report!.faithfulness?.scored_queries ?? 0) > 0 && (
                      <SegBar label="Truthfulness — answer backed by the source document (not made up)" value={report!.faithfulness!.avg_faithfulness_score} />
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-[11px] font-medium text-muted-foreground">Exact Word Match Rate</span>
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
                      Results by Language
                    </h2>
                  </div>
                  <InfoNote>How the AI performs when answering in each language.</InfoNote>
                  <div className="mt-3 border border-border">
                    <ScrollArea className="w-full whitespace-nowrap">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            {["Language", "Questions", "Search Accuracy", "Avg Speed", "Reading Level"].map(h => (
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
            TAB 2 — ANSWER ACCURACY TEST
        ════════════════════════════════════ */}
        <div className={cn("space-y-6", activeTab !== "testsuite" && "hidden")}>
          <InfoNote>
            The system runs a set of pre-written questions against the document and compares the AI&apos;s answers
            against expert-written expected answers. This shows how accurate and reliable the AI is.
          </InfoNote>

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
                  <SelectValue placeholder="Auto (recommended)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__auto__">Auto (recommended)</SelectItem>
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
                  Run Accuracy Test
                </Button>
              )}
            </div>

            {/* Category pills */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Built-in test questions:</span>
              {[
                { key: "identity", label: "MyKad / Identity", count: 5 },
                { key: "passport", label: "Passport", count: 6 },
              ].map(cat => (
                <span key={cat.key} className="inline-flex items-center gap-1.5 border border-border bg-muted/30 px-2.5 py-1 text-muted-foreground">
                  <span className="font-medium text-foreground">{cat.label}</span>
                  <span className="bg-muted px-1 py-0.5 font-mono text-[10px] tabular-nums">{cat.count} questions</span>
                </span>
              ))}
              <span className="border border-border bg-muted/30 px-2.5 py-1 text-muted-foreground">English · Malay · Chinese</span>
            </div>

            {/* Category / unrelated status */}
            {detectedCategory === "unrelated" && skippedReason && (
              <div className="mt-4 flex items-start gap-3 border border-border bg-muted/20 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Document not matched to any test category</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    The built-in test questions are written for the MyKad FAQ and Malaysian passport guideline documents.
                    Please select one of those documents, or add your own test questions.
                  </p>
                </div>
              </div>
            )}
            {detectedCategory && detectedCategory !== "unrelated" && (
              <div className="mt-4 flex items-center gap-2 border border-success/20 bg-success/5 px-4 py-2.5">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                <span className="text-sm text-success">
                  Matched: <span className="font-medium capitalize">{detectedCategory.replace("_", " ")}</span>
                  {streamProgress && <span className="ml-2 opacity-75">— running {streamProgress.total} test questions</span>}
                </span>
              </div>
            )}
          </div>

          {/* Streaming progress */}
          {streamProgress && (
            <div className="border border-border bg-card p-5">
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Running accuracy test…</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {streamProgress.completed} / {streamProgress.total} questions
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
                    {testResult.aggregate.cases_run} questions tested
                    {testResult.aggregate.cases_failed > 0 && (
                      <span className="ml-2 text-sm font-normal text-warning">({testResult.aggregate.cases_failed} failed)</span>
                    )}
                  </span>
                </div>
                <InfoNote>
                  Scores range from 0 to 1. Higher = better match with the expected answer.
                  A score of 0.3 or above on Keyword Match is considered good for a real-world AI system.
                </InfoNote>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Keyword Match",  value: testResult.aggregate.avg_rouge1_f1 },
                    { label: "Phrase Match",   value: testResult.aggregate.avg_rouge2_f1 },
                    { label: "Answer Flow",    value: testResult.aggregate.avg_rougeL_f1 },
                    { label: "Overall Score",  value: testResult.aggregate.avg_bleu },
                  ].map(({ label, value }) => (
                    <div key={label} className="border border-border/50 bg-card p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="mt-0.5 font-heading text-xl font-bold tabular-nums">{value.toFixed(3)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Reading Level: <GradeBadge grade={testResult.aggregate.avg_fk_grade} /></span>
                  <span>Search Accuracy: <strong className="text-foreground">{pct(testResult.aggregate.avg_confidence)}</strong></span>
                  <span>Avg Speed: <strong className="font-mono text-foreground">{testResult.aggregate.avg_latency_ms}ms</strong></span>
                  {testResult.aggregate.avg_semantic_similarity != null && (
                    <span>Meaning Match: <strong className="font-mono text-foreground">{testResult.aggregate.avg_semantic_similarity.toFixed(3)}</strong></span>
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
                            <span className={cn("font-mono text-xs tabular-nums", r1Cls)}>Match {r.scores.rouge1_f1.toFixed(3)}</span>
                            <GradeBadge grade={r.scores.fk_grade} />
                            {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="space-y-4 border-t border-border bg-muted/10 p-4">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {[
                                { label: "Keyword Match",  value: r.scores.rouge1_f1 },
                                { label: "Phrase Match",   value: r.scores.rouge2_f1 },
                                { label: "Answer Flow",    value: r.scores.rougeL_f1 },
                                { label: "Overall Score",  value: r.scores.bleu },
                              ].map(({ label, value }) => (
                                <div key={label} className="border border-border/50 bg-card p-2.5 text-center">
                                  <p className="text-[10px] text-muted-foreground">{label}</p>
                                  <p className="mt-0.5 font-mono text-base font-bold tabular-nums">{value.toFixed(3)}</p>
                                </div>
                              ))}
                            </div>
                            <div className="grid gap-3 text-xs sm:grid-cols-2">
                              <div>
                                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">AI&apos;s Answer</p>
                                <p className="border border-border bg-card p-3 text-xs leading-relaxed text-foreground/80">{r.answer}</p>
                              </div>
                              <div>
                                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-success uppercase">Expected Answer</p>
                                <p className="border border-success/20 bg-success/5 p-3 text-xs leading-relaxed text-foreground/80">{r.ground_truth}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>Search Accuracy: <strong className="text-foreground">{pct(r.scores.confidence)}</strong></span>
                              <span>Response Time: <strong className="font-mono text-foreground">{r.scores.latency_ms}ms</strong></span>
                              {r.scores.semantic_similarity != null && (
                                <span>Meaning Match: <strong className="font-mono text-foreground">{r.scores.semantic_similarity.toFixed(3)}</strong></span>
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
            TAB 3 — LANGUAGE SIMPLIFICATION
        ════════════════════════════════════ */}
        <div className={cn(activeTab !== "simplify" && "hidden")}>
          <InfoNote>
            Government documents often use formal, complex language. This system automatically rewrites
            those passages into simple, everyday language before showing answers to users.
            Here are real before-and-after examples from this AI.
          </InfoNote>
          <div className="mt-5">
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
                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-warning uppercase">Before — Original Government Language</p>
                        <p className="text-sm leading-relaxed text-foreground/70">{ex.original}</p>
                      </div>
                      <div className="bg-success/5 p-4">
                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-success uppercase">After — Plain, Easy-to-Read Language</p>
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
        </div>

        {/* ════════════════════════════════════
            TAB 4 — MULTILINGUAL EXPANSION
        ════════════════════════════════════ */}
        <div className={cn(activeTab !== "augment" && "hidden")}>
          <InfoNote>
            When you ask a question, the AI automatically rewrites it in multiple languages and phrasings
            before searching the document. This helps it find the best match even when the question wording
            differs from the document language. Enter any question below to see this in action.
          </InfoNote>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
                        {isParaphrase ? `${info.name} — Simplified phrasing` : info.name}
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
