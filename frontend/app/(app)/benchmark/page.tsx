"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react"

import {
  Document,
  EvalReport,
  StreamEvent,
  TestSuiteResult,
  getEvalReport,
  listDocuments,
  runTestSuiteStream,
} from "@/lib/api"
import { useLanguage } from "@/components/language-provider"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%` }
function fmt3(v: number) { return v.toFixed(3) }
function formatLatency(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s` }

type Tone = "success" | "primary" | "warning"

function scoreToneOf(s: number): Tone {
  return s >= 80 ? "success" : s >= 60 ? "primary" : "warning"
}

const SCORE_CONFIG: Record<Tone, { border: string; bg: string; text: string; label: string }> = {
  success: { border: "border-success/30", bg: "bg-success/5",  text: "text-success",  label: "Competition Ready"  },
  primary: { border: "border-primary/30", bg: "bg-primary/5",  text: "text-primary",  label: "Good Foundation"    },
  warning: { border: "border-warning/30", bg: "bg-warning/10", text: "text-warning",  label: "Needs Attention"    },
}

// ── benchmarkGrade ─────────────────────────────────────────────────────────

function benchmarkGrade(result: TestSuiteResult | null, report: EvalReport | null) {
  const rouge       = result?.aggregate.avg_rouge1_f1       ?? report?.generation_quality?.avg_rouge1_f1   ?? 0
  const confidence  = result?.aggregate.avg_confidence      ?? report?.retrieval?.avg_confidence           ?? 0
  const readability = result?.aggregate.avg_fk_grade        ?? report?.readability?.avg_fk_grade           ?? 12
  const latency     = result?.aggregate.avg_latency_ms      ?? report?.latency?.avg_ms                     ?? 4000
  const faithfulness = (report?.faithfulness?.scored_queries ?? 0) > 0
    ? report!.faithfulness!.avg_faithfulness_score : 0.75

  const rougeScore       = Math.min(1, rouge / 0.25)
  const readabilityScore = Math.max(0, Math.min(1, 1 - Math.max(readability - 5, 0) / 7))
  const latencyScore     = Math.max(0, Math.min(1, 1 - latency / 6000))

  return Math.round(
    rougeScore       * 0.15 +
    confidence       * 0.35 +
    readabilityScore * 0.15 +
    latencyScore     * 0.15 +
    faithfulness     * 0.20
  ) * 100 / 100
}

// ── SegBar ─────────────────────────────────────────────────────────────────

function SegBar({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const ratio = Math.min(value / max, 1)
  const filled = Math.round(ratio * 10)
  const color = ratio >= 0.65 ? "bg-success" : ratio >= 0.35 ? "bg-primary" : "bg-warning"
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground/70">{fmt3(value)}</span>
      </div>
      <div aria-hidden className="flex gap-[3px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-[1px]", i < filled ? color : "bg-muted")} />
        ))}
      </div>
    </div>
  )
}

// ── StatTile ───────────────────────────────────────────────────────────────

function StatTile({
  label, value, sub, icon: Icon, tone = "default",
}: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: Tone | "default"
}) {
  const valueClass = tone === "success" ? "text-success"
    : tone === "warning" ? "text-warning"
    : tone === "primary" ? "text-primary"
    : "text-foreground"
  const borderClass = tone === "success" ? "border-l-success"
    : tone === "warning" ? "border-l-warning"
    : tone === "primary" ? "border-l-primary"
    : "border-l-border"
  return (
    <div className={cn("border border-border border-l-[3px] bg-card p-4 transition-colors hover:border-primary/20", borderClass)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <Icon className={cn("h-4 w-4", valueClass)} />
      </div>
      <p className={cn("font-heading text-3xl font-bold tracking-tight tabular-nums", valueClass)}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const { language } = useLanguage()
  const [documents, setDocuments]       = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState("")
  const [report, setReport]             = useState<EvalReport | null>(null)
  const [testResult, setTestResult]     = useState<TestSuiteResult | null>(null)
  const [loading, setLoading]           = useState(true)
  const [running, setRunning]           = useState(false)
  const [progress, setProgress]         = useState<{
    completed: number; total: number; currentQuestion: string
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const copy = language === "ms"
    ? {
        loadError: "Gagal memuatkan data benchmark",
        retry: "Sila cuba lagi.",
        selectReady: "Pilih dokumen yang sedia dahulu",
        skipped: "Benchmark dilangkau",
        complete: "Benchmark selesai",
        failed: "Benchmark gagal",
        title: "Makmal Benchmark",
        body: "Halaman ini memfokuskan output pada metrik benchmark yang paling penting untuk juri.",
        noReady: "Tiada dokumen sedia",
        running: "Benchmark sedang dijalankan…",
        run: "Jalankan Benchmark",
        casesComplete: "kes selesai",
        current: "Semasa",
        benchmarkScore: "Skor Benchmark",
        benchmarkScoreSub: "Skor berwajaran dari kualiti, keyakinan, kebolehbacaan, dan kelajuan",
        rouge1Sub: "Pertindihan perkataan (0.10–0.30 normal untuk RAG)",
        confidenceSub: "Purata keyakinan carian",
        readabilitySub: "Gred Flesch-Kincaid — lebih rendah lebih baik",
        latencySub: "Purata masa respons",
        latestResults: "Keputusan Per Kes",
        caseRun: "kes dijalankan",
        noResults: "Belum ada benchmark dijalankan",
        noResultsSub: "Pilih dokumen dan jalankan benchmark.",
        scorecard: "Interpretasi Skor",
        scorecardHeading: "Apa maksud skor ini",
        above80: "80 ke atas — Competition Ready",
        above80Sub: "Keyakinan carian tinggi, respons pantas, output bahasa mudah.",
        range6079: "60 hingga 79 — Good Foundation",
        range6079Sub: "Carian berfungsi — ruang untuk tingkatkan kebolehbacaan atau kelajuan.",
        below60: "Di bawah 60 — Needs Attention",
        below60Sub: "Keyakinan carian atau kebolehbacaan perlu perhatian.",
        rougeNote: "Tentang ROUGE & BLEU",
        rougeNoteBody: "ROUGE dan BLEU mengukur pertindihan perkataan antara jawapan yang dihasilkan dengan jawapan rujukan tetap. Untuk RAG generatif, skor 0.10–0.30 adalah normal — model menjawab dari dokumen anda menggunakan bahasanya sendiri.",
        rougeTypical: "Julat normal RAG generatif: ROUGE-1 0.10–0.30",
        liveSnapshot: "Snapshot Laporan",
        recordedQueries: "Soalan direkodkan",
        p95Latency: "Kelajuan P95",
        aboveThreshold: "Di atas ambang",
        simpleLanguage: "Kadar bahasa mudah",
        faithfulness: "Skor ketepatan sumber",
        noReport: "Tiada laporan penilaian lagi. Jalankan benchmark atau gunakan aplikasi untuk menjana metrik.",
        refresh: "Muat Semula",
      }
    : {
        loadError: "Failed to load benchmark data",
        retry: "Please try again.",
        selectReady: "Select a ready document first",
        skipped: "Benchmark skipped",
        complete: "Benchmark complete",
        failed: "Benchmark failed",
        title: "Benchmark Lab",
        body: "Measure quality on one selected document. Focused on the numbers judges care about most.",
        noReady: "No ready documents",
        running: "Running benchmark…",
        run: "Run Benchmark",
        casesComplete: "cases complete",
        current: "Current",
        benchmarkScore: "Benchmark Score",
        benchmarkScoreSub: "Weighted score from quality, confidence, readability, and latency",
        rouge1Sub: "Word overlap vs reference (0.10–0.30 normal for RAG)",
        confidenceSub: "Average retrieval confidence",
        readabilitySub: "Flesch-Kincaid grade — lower is easier",
        latencySub: "Average response time",
        latestResults: "Per-Case Results",
        caseRun: "cases run",
        noResults: "No benchmark run yet",
        noResultsSub: "Select a ready document and run benchmark to populate this page.",
        scorecard: "Score Interpretation",
        scorecardHeading: "What the benchmark means",
        above80: "80 and above — Competition Ready",
        above80Sub: "High retrieval confidence, fast responses, and plain-language output.",
        range6079: "60 to 79 — Good Foundation",
        range6079Sub: "Retrieval is working — room to improve readability or latency.",
        below60: "Below 60 — Needs Attention",
        below60Sub: "Retrieval confidence or readability needs attention.",
        rougeNote: "About ROUGE & BLEU",
        rougeNoteBody: "ROUGE and BLEU measure word overlap between the generated answer and a fixed reference. For open-domain generative RAG, 0.10–0.30 is normal — the model answers from your document using its own language.",
        rougeTypical: "Typical generative RAG range: ROUGE-1 0.10–0.30",
        liveSnapshot: "Report Snapshot",
        recordedQueries: "Recorded queries",
        p95Latency: "P95 latency",
        aboveThreshold: "Above threshold",
        simpleLanguage: "Simple language rate",
        faithfulness: "Faithfulness score",
        noReport: "No evaluation report yet. Run a benchmark or use the app to generate metrics.",
        refresh: "Refresh",
      }

  const selectedDoc = useMemo(() => documents.find(d => d.id === selectedDocId) ?? null, [documents, selectedDocId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [docs, evalReport] = await Promise.all([listDocuments(), getEvalReport()])
      const readyDocs = docs.filter(d => d.status === "ready")
      setDocuments(readyDocs)
      setSelectedDocId(prev => prev || readyDocs[0]?.id || "")
      setReport(evalReport)
    } catch (error) {
      toast.error(copy.loadError, { description: error instanceof Error ? error.message : copy.retry })
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadData() }, [])

  const handleRunBenchmark = async () => {
    if (!selectedDoc) { toast.error(copy.selectReady); return }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRunning(true)
    setTestResult(null)
    setProgress({ completed: 0, total: 1, currentQuestion: "" })

    try {
      await runTestSuiteStream(selectedDoc.id, selectedDoc.name, "", (event: StreamEvent) => {
        if (event.type === "category") {
          setProgress(prev => prev ? { ...prev, total: event.total } : prev)
        } else if (event.type === "progress") {
          setProgress(prev => prev
            ? { ...prev, completed: event.index + 1, total: event.total, currentQuestion: event.result.question }
            : prev)
        } else if (event.type === "aggregate") {
          setTestResult({ status: "ok", aggregate: event.aggregate, results: event.results, errors: event.errors })
          setProgress(null)
        } else if (event.type === "skipped") {
          setProgress(null)
          toast.warning(copy.skipped, { description: event.reason })
        }
      }, controller.signal)

      const refreshed = await getEvalReport()
      setReport(refreshed)
      toast.success(copy.complete)
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast.error(copy.failed, { description: error.message })
      }
      setProgress(null)
    } finally { setRunning(false) }
  }

  const rawScore = benchmarkGrade(testResult, report)
  const overallScore = Math.round(rawScore * 100)
  const aggregate = testResult?.aggregate
  const scoreTone = scoreToneOf(overallScore)
  const scoreConf = SCORE_CONFIG[scoreTone]

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">

        {/* ── Compact page header ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">{copy.title}</h1>
          </div>
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {copy.refresh}
          </button>
        </div>

        {/* ── Score hero + run controls ── */}
        <section className={cn("border p-5 sm:p-6", scoreConf.border, scoreConf.bg)}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Score display */}
            <div className="flex items-end gap-5">
              <div>
                <p className={cn("text-[10px] font-semibold tracking-[0.18em] uppercase", scoreConf.text)}>
                  {copy.benchmarkScore}
                </p>
                <div className="flex items-baseline gap-3">
                  <span className={cn("font-heading text-7xl font-black tracking-tight tabular-nums sm:text-8xl", scoreConf.text)}>
                    {loading ? "—" : overallScore}
                  </span>
                  <span className="text-2xl font-normal text-muted-foreground/50">/100</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={cn(
                    "inline-flex items-center border px-2.5 py-0.5 text-[11px] font-semibold",
                    scoreConf.border, scoreConf.text,
                    scoreTone === "success" ? "bg-success/10" : scoreTone === "warning" ? "bg-warning/10" : "bg-primary/10"
                  )}>
                    {scoreConf.label}
                  </span>
                  {aggregate && (
                    <span className="text-[11px] text-muted-foreground">
                      {aggregate.cases_run} {copy.caseRun}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{copy.benchmarkScoreSub}</p>
              </div>
            </div>

            {/* Run controls */}
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[300px]">
              <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                <SelectTrigger className="border-border bg-background text-sm focus:border-primary focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder={copy.noReady} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {documents.length === 0 ? (
                      <SelectItem value="__empty__" disabled>{copy.noReady}</SelectItem>
                    ) : (
                      documents.map(doc => <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>)
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <button
                onClick={() => void handleRunBenchmark()}
                disabled={!selectedDoc || running}
                className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {copy.running}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {copy.run}
                  </>
                )}
              </button>

              {progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{progress.completed}/{progress.total} {copy.casesComplete}</span>
                    <span className="font-mono">{Math.round((progress.completed / Math.max(progress.total, 1)) * 100)}%</span>
                  </div>
                  <div className="flex gap-[3px]" aria-hidden>
                    {Array.from({ length: 10 }).map((_, i) => {
                      const filled = progress.total > 0 && (progress.completed / progress.total) > i / 10
                      return <span key={i} className={cn("h-1.5 flex-1 rounded-[1px] transition-all duration-500", filled ? "bg-primary" : "bg-muted/60")} />
                    })}
                  </div>
                  {progress.currentQuestion && (
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      {copy.current}: <em>{progress.currentQuestion}</em>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 4 metric tiles ── */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="ROUGE-1"
            value={fmt3(aggregate?.avg_rouge1_f1 ?? report?.generation_quality?.avg_rouge1_f1 ?? 0)}
            sub={copy.rouge1Sub}
            icon={Sparkles}
            tone={(() => {
              const v = aggregate?.avg_rouge1_f1 ?? report?.generation_quality?.avg_rouge1_f1 ?? 0
              return v >= 0.25 ? "success" : v >= 0.1 ? "primary" : "warning"
            })()}
          />
          <StatTile
            label="Confidence"
            value={pct(aggregate?.avg_confidence ?? report?.retrieval?.avg_confidence ?? 0)}
            sub={copy.confidenceSub}
            icon={ShieldCheck}
            tone={(() => {
              const v = aggregate?.avg_confidence ?? report?.retrieval?.avg_confidence ?? 0
              return v >= 0.75 ? "success" : v >= 0.5 ? "primary" : "warning"
            })()}
          />
          <StatTile
            label="Readability"
            value={(aggregate?.avg_fk_grade ?? report?.readability?.avg_fk_grade ?? 0).toFixed(1)}
            sub={copy.readabilitySub}
            icon={CheckCircle2}
            tone={(() => {
              const v = aggregate?.avg_fk_grade ?? report?.readability?.avg_fk_grade ?? 12
              return v <= 5 ? "success" : v <= 7 ? "primary" : "warning"
            })()}
          />
          <StatTile
            label="Latency"
            value={formatLatency(aggregate?.avg_latency_ms ?? report?.latency?.avg_ms ?? 0)}
            sub={copy.latencySub}
            icon={Clock3}
            tone={(() => {
              const v = aggregate?.avg_latency_ms ?? report?.latency?.avg_ms ?? 4000
              return v <= 1500 ? "success" : v <= 3000 ? "primary" : "warning"
            })()}
          />
        </section>

        {/* ── Results + right panel ── */}
        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          {/* Per-case results */}
          <div className="border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">{copy.latestResults}</p>
                <h3 className="mt-0.5 font-heading text-lg font-bold tracking-tight">
                  {aggregate ? `${aggregate.cases_run} ${copy.caseRun}` : copy.noResults}
                </h3>
              </div>
              {aggregate && (
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{fmt3(aggregate.avg_rouge1_f1)}</p>
                  <p className="text-[10px] text-muted-foreground">ROUGE-1</p>
                </div>
              )}
            </div>

            {!testResult ? (
              <div className="flex min-h-[280px] items-center justify-center p-8 text-center">
                <div className="space-y-3">
                  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/20" />
                  <p className="font-medium text-foreground">{copy.noResults}</p>
                  <p className="text-sm text-muted-foreground">{copy.noResultsSub}</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {testResult.results.map(result => {
                  const r1 = result.scores.rouge1_f1
                  const r1Tone = r1 >= 0.25 ? "text-success" : r1 >= 0.1 ? "text-primary" : "text-warning"
                  const confTone = result.scores.confidence >= 0.75 ? "text-success" : result.scores.confidence >= 0.5 ? "text-primary" : "text-warning"
                  return (
                    <div key={`${result.case_index}-${result.question}`} className="p-4 transition-colors hover:bg-muted/20">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-semibold text-foreground">{result.question}</p>
                        <span className="shrink-0 bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                          {result.language.toUpperCase()}
                        </span>
                      </div>
                      <div className="mb-3 grid grid-cols-4 gap-2">
                        {[
                          { label: "ROUGE-1", value: fmt3(result.scores.rouge1_f1), cls: r1Tone },
                          { label: "BLEU",    value: fmt3(result.scores.bleu),        cls: "" },
                          { label: "Conf",    value: pct(result.scores.confidence),  cls: confTone },
                          { label: "Speed",   value: formatLatency(result.scores.latency_ms), cls: "" },
                        ].map(({ label, value, cls }) => (
                          <div key={label} className="bg-muted/30 px-2.5 py-2">
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                            <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", cls || "text-foreground")}>{value}</p>
                          </div>
                        ))}
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{result.answer}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* ROUGE context */}
            <div className="border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-primary" />
                <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">{copy.rougeNote}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{copy.rougeNoteBody}</p>
              <div className="mt-3 border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="font-mono text-[11px] text-primary">{copy.rougeTypical}</p>
              </div>
            </div>

            {/* Scorecard */}
            <div className="border border-border bg-card p-5">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">{copy.scorecard}</p>
              <h3 className="mt-0.5 font-heading text-base font-bold">{copy.scorecardHeading}</h3>
              <div className="mt-4 space-y-2">
                {[
                  { label: copy.above80,    sub: copy.above80Sub,    tone: "success" as const },
                  { label: copy.range6079,  sub: copy.range6079Sub,  tone: "primary" as const },
                  { label: copy.below60,    sub: copy.below60Sub,    tone: "warning" as const },
                ].map(({ label, sub, tone }) => {
                  const cfg = SCORE_CONFIG[tone]
                  const active = scoreTone === tone && overallScore > 0
                  return (
                    <div key={label} className={cn("border-l-[3px] px-3 py-2.5 text-sm transition-colors",
                      cfg.border,
                      active ? cn(cfg.bg, "border border-r border-t border-b", cfg.border) : "border-l"
                    )}>
                      <p className={cn("font-semibold", active ? cfg.text : "text-foreground")}>{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Live snapshot */}
            <div className="border border-border bg-card p-5">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">{copy.liveSnapshot}</p>
              {report?.status === "ok" ? (
                <div className="mt-4 space-y-2">
                  {[
                    { label: copy.recordedQueries, value: String(report.total_queries) },
                    { label: copy.p95Latency,       value: formatLatency(report.latency?.p95_ms ?? 0) },
                    { label: copy.aboveThreshold,    value: `${report.retrieval?.pct_above_threshold ?? 0}%` },
                    { label: copy.simpleLanguage,    value: `${report.readability?.pct_simple_language ?? 0}%` },
                    ...((report.faithfulness?.scored_queries ?? 0) > 0
                      ? [{ label: copy.faithfulness, value: `${Math.round(report.faithfulness!.avg_faithfulness_score * 100)}%` }]
                      : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between bg-muted/20 px-3 py-2.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-dashed border-border bg-muted/10 px-4 py-5 text-xs text-muted-foreground">
                  {copy.noReport}
                </div>
              )}
            </div>

            {/* ROUGE score bars (if generation quality) */}
            {report?.generation_quality && (
              <div className="border border-border bg-card p-5">
                <p className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
                  <TrendingUp className="mr-1 inline h-3 w-3" />
                  Generation Quality
                </p>
                <div className="space-y-3">
                  <SegBar label="ROUGE-1 F1" value={report.generation_quality.avg_rouge1_f1} max={0.5} />
                  <SegBar label="ROUGE-L F1" value={report.generation_quality.avg_rougeL_f1} max={0.4} />
                  <SegBar label="BLEU" value={report.generation_quality.avg_bleu} max={0.3} />
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
