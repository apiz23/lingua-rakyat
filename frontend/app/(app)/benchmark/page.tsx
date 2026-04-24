"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
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
import PageIntro from "@/components/page-intro"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function score(value: number, decimals = 3) {
  return value.toFixed(decimals)
}

function formatLatency(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function benchmarkGrade(
  result: TestSuiteResult | null,
  report: EvalReport | null
) {
  const rouge =
    result?.aggregate.avg_rouge1_f1 ??
    report?.generation_quality?.avg_rouge1_f1 ??
    0
  const confidence =
    result?.aggregate.avg_confidence ?? report?.retrieval?.avg_confidence ?? 0
  const readability =
    result?.aggregate.avg_fk_grade ?? report?.readability?.avg_fk_grade ?? 12
  const latency =
    result?.aggregate.avg_latency_ms ?? report?.latency?.avg_ms ?? 4000

  const readabilityScore = Math.max(
    0,
    Math.min(1, 1 - Math.max(readability - 5, 0) / 7)
  )
  const latencyScore = Math.max(0, Math.min(1, 1 - latency / 6000))
  const blended =
    rouge * 0.4 +
    confidence * 0.3 +
    readabilityScore * 0.15 +
    latencyScore * 0.15

  return Math.round(blended * 100)
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="border border-border bg-card/40 p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </p>
        <div className="bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

export default function BenchmarkPage() {
  const { language } = useLanguage()
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState("")
  const [report, setReport] = useState<EvalReport | null>(null)
  const [testResult, setTestResult] = useState<TestSuiteResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{
    completed: number
    total: number
    currentQuestion: string
  } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const copy =
    language === "ms"
      ? {
          loadError: "Gagal memuatkan data benchmark",
          retry: "Sila cuba lagi.",
          selectReady: "Pilih dokumen yang sedia dahulu",
          skipped: "Benchmark dilangkau",
          complete: "Benchmark selesai",
          failed: "Benchmark gagal",
          title: "Makmal Benchmark",
          subtitle: "Paparan benchmark ringkas untuk demo dan pemarkahan juri",
          refresh: "Muat Semula",
          manage: "Urus Dokumen",
          runTag: "Jalankan Benchmark",
          heading: "Ukur kualiti bagi satu dokumen terpilih",
          body: "Halaman ini menggunakan pipeline penilaian sedia ada, tetapi memfokuskan output pada metrik benchmark yang paling penting untuk juri: kualiti jawapan, keyakinan carian, kebolehbacaan, dan kelajuan respons.",
          noReady: "Tiada dokumen sedia",
          running: "Benchmark sedang dijalankan",
          run: "Jalankan benchmark",
          casesComplete: "kes selesai",
          current: "Semasa",
          benchmarkScore: "Skor Benchmark",
          benchmarkScoreSub:
            "Skor berwajaran dari kualiti, keyakinan, kebolehbacaan, dan kelajuan",
          rouge1: "ROUGE-1",
          rouge1Sub: "Padanan jawapan dengan rujukan benchmark",
          confidence: "Keyakinan",
          confidenceSub: "Purata keyakinan carian",
          readability: "Kebolehbacaan",
          readabilitySub: "Lebih rendah lebih mudah dibaca",
          latency: "Kelajuan",
          latencySub: "Purata masa respons",
          latestResults: "Keputusan Terkini",
          latestResultsHeading: "Output benchmark per kes",
          caseRun: "kes dijalankan",
          noResults: "Belum ada benchmark dijalankan",
          noResultsSub:
            "Pilih dokumen yang sedia dan jalankan benchmark untuk mengisi halaman ini.",
          scorecard: "Scorecard",
          scorecardHeading: "What the benchmark means",
          above80: "Above 80",
          above80Sub:
            "Strong competition-ready benchmark profile with balanced quality and usability.",
          range6079: "60 to 79",
          range6079Sub:
            "Good foundation, but still room to improve answer quality or simplicity.",
          below60: "Below 60",
          below60Sub:
            "Retrieval confidence, benchmark truth overlap, or prompt quality needs work.",
          liveSnapshot: "Live Report Snapshot",
          liveSnapshotHeading: "Stored evaluation metrics",
          recordedQueries: "Recorded queries",
          p95Latency: "P95 latency",
          aboveThreshold: "Above threshold",
          simpleLanguage: "Simple language rate",
          noReport:
            "No stored evaluation report yet. Run a benchmark or use the app to generate metrics.",
        }
      : {
          loadError: "Failed to load benchmark data",
          retry: "Please try again.",
          selectReady: "Select a ready document first",
          skipped: "Benchmark skipped",
          complete: "Benchmark complete",
          failed: "Benchmark failed",
          title: "Benchmark Lab",
          subtitle: "Fast benchmark view for demo runs and judge scoring",
          refresh: "Refresh",
          manage: "Manage Documents",
          runTag: "Run Benchmark",
          heading: "Measure quality on one selected document",
          body: "This page uses the existing evaluation pipeline, but keeps the output focused on the benchmark numbers judges care about most: answer quality, retrieval confidence, readability, and latency.",
          noReady: "No ready documents",
          running: "Running benchmark",
          run: "Run benchmark",
          casesComplete: "cases complete",
          current: "Current",
          benchmarkScore: "Benchmark Score",
          benchmarkScoreSub:
            "Weighted score from quality, confidence, readability, and latency",
          rouge1: "ROUGE-1",
          rouge1Sub: "Answer match vs benchmark reference",
          confidence: "Confidence",
          confidenceSub: "Average retrieval confidence",
          readability: "Readability",
          readabilitySub: "Lower is easier to read",
          latency: "Latency",
          latencySub: "Average response time",
          latestResults: "Latest Results",
          latestResultsHeading: "Per-case benchmark output",
          caseRun: "cases run",
          noResults: "No benchmark run yet",
          noResultsSub:
            "Select a ready document and run benchmark to populate this page.",
          scorecard: "Scorecard",
          scorecardHeading: "What the benchmark means",
          above80: "Above 80",
          above80Sub:
            "Strong competition-ready benchmark profile with balanced quality and usability.",
          range6079: "60 to 79",
          range6079Sub:
            "Good foundation, but still room to improve answer quality or simplicity.",
          below60: "Below 60",
          below60Sub:
            "Retrieval confidence, benchmark truth overlap, or prompt quality needs work.",
          liveSnapshot: "Live Report Snapshot",
          liveSnapshotHeading: "Stored evaluation metrics",
          recordedQueries: "Recorded queries",
          p95Latency: "P95 latency",
          aboveThreshold: "Above threshold",
          simpleLanguage: "Simple language rate",
          noReport:
            "No stored evaluation report yet. Run a benchmark or use the app to generate metrics.",
        }

  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedDocId) ?? null,
    [documents, selectedDocId]
  )

  const loadData = async () => {
    setLoading(true)
    try {
      const [docs, evalReport] = await Promise.all([
        listDocuments(),
        getEvalReport(),
      ])
      const readyDocs = docs.filter((doc) => doc.status === "ready")
      setDocuments(readyDocs)
      setSelectedDocId((prev) => prev || readyDocs[0]?.id || "")
      setReport(evalReport)
    } catch (error) {
      toast.error(copy.loadError, {
        description: error instanceof Error ? error.message : copy.retry,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleRunBenchmark = async () => {
    if (!selectedDoc) {
      toast.error(copy.selectReady)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRunning(true)
    setTestResult(null)
    setProgress({
      completed: 0,
      total: 1,
      currentQuestion: "",
    })

    try {
      await runTestSuiteStream(
        selectedDoc.id,
        selectedDoc.name,
        "",
        (event: StreamEvent) => {
          if (event.type === "category") {
            setProgress((prev) =>
              prev
                ? {
                    ...prev,
                    total: event.total,
                  }
                : prev
            )
          } else if (event.type === "progress") {
            setProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: event.index + 1,
                    total: event.total,
                    currentQuestion: event.result.question,
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
            setProgress(null)
          } else if (event.type === "skipped") {
            setProgress(null)
            toast.warning(copy.skipped, {
              description: event.reason,
            })
          }
        },
        controller.signal
      )

      const refreshed = await getEvalReport()
      setReport(refreshed)
      toast.success(copy.complete)
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast.error(copy.failed, {
          description: error instanceof Error ? error.message : copy.retry,
        })
      }
      setProgress(null)
    } finally {
      setRunning(false)
    }
  }

  const overallScore = benchmarkGrade(testResult, report)
  const aggregate = testResult?.aggregate

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <PageIntro
          eyebrow={copy.runTag}
          title={copy.title}
          description={copy.body}
          icon={BarChart3}
          actions={
            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {copy.refresh}
            </button>
          }
        />

        {/* Run section */}
        <section className="border border-border bg-card/40 p-6 backdrop-blur-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                {copy.runTag}
              </p>
              <h2 className="font-heading text-3xl font-bold tracking-tight">
                {copy.heading}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {copy.body}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[340px]">
              <select
                value={selectedDocId}
                onChange={(event) => setSelectedDocId(event.target.value)}
                className="border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
              >
                {documents.length === 0 ? (
                  <option value="">{copy.noReady}</option>
                ) : (
                  documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name}
                    </option>
                  ))
                )}
              </select>
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
            </div>
          </div>

          {progress && (
            <div className="mt-6 border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {progress.completed}/{progress.total} {copy.casesComplete}
                </span>
                <span className="text-muted-foreground">
                  {Math.round(
                    (progress.completed / Math.max(progress.total, 1)) * 100
                  )}
                  %
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${(progress.completed / Math.max(progress.total, 1)) * 100}%`,
                  }}
                />
              </div>
              {progress.currentQuestion && (
                <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
                  {copy.current}: {progress.currentQuestion}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Metric cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label={copy.benchmarkScore}
            value={`${overallScore}/100`}
            sub={copy.benchmarkScoreSub}
            icon={Target}
          />
          <MetricCard
            label={copy.rouge1}
            value={score(
              aggregate?.avg_rouge1_f1 ??
                report?.generation_quality?.avg_rouge1_f1 ??
                0
            )}
            sub={copy.rouge1Sub}
            icon={Sparkles}
          />
          <MetricCard
            label={copy.confidence}
            value={pct(
              aggregate?.avg_confidence ??
                report?.retrieval?.avg_confidence ??
                0
            )}
            sub={copy.confidenceSub}
            icon={ShieldCheck}
          />
          <MetricCard
            label={copy.readability}
            value={(
              aggregate?.avg_fk_grade ??
              report?.readability?.avg_fk_grade ??
              0
            ).toFixed(1)}
            sub={copy.readabilitySub}
            icon={CheckCircle2}
          />
          <MetricCard
            label={copy.latency}
            value={formatLatency(
              aggregate?.avg_latency_ms ?? report?.latency?.avg_ms ?? 0
            )}
            sub={copy.latencySub}
            icon={Clock3}
          />
        </section>

        {/* Results + Scorecard */}
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Per-case results */}
          <div className="border border-border bg-card/40 p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                  {copy.latestResults}
                </p>
                <h3 className="mt-1 font-heading text-xl font-bold tracking-tight">
                  {copy.latestResultsHeading}
                </h3>
              </div>
              {aggregate && (
                <span className="border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  {aggregate.cases_run} {copy.caseRun}
                </span>
              )}
            </div>

            {!testResult ? (
              <div className="flex min-h-[320px] items-center justify-center border border-dashed border-border bg-muted/10 text-center">
                <div className="space-y-3 px-6">
                  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="font-medium text-foreground">{copy.noResults}</p>
                  <p className="text-sm text-muted-foreground">
                    {copy.noResultsSub}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {testResult.results.map((result) => (
                  <div
                    key={`${result.case_index}-${result.question}`}
                    className="border border-border bg-background p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">
                        {result.question}
                      </p>
                      <span className="bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        {result.language}
                      </span>
                    </div>
                    <div className="mb-3 grid gap-2 sm:grid-cols-4">
                      <div className="bg-muted/30 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">ROUGE-1</span>
                        <p className="mt-1 font-mono text-foreground">
                          {score(result.scores.rouge1_f1)}
                        </p>
                      </div>
                      <div className="bg-muted/30 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">BLEU</span>
                        <p className="mt-1 font-mono text-foreground">
                          {score(result.scores.bleu)}
                        </p>
                      </div>
                      <div className="bg-muted/30 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Confidence</span>
                        <p className="mt-1 font-mono text-foreground">
                          {pct(result.scores.confidence)}
                        </p>
                      </div>
                      <div className="bg-muted/30 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Latency</span>
                        <p className="mt-1 font-mono text-foreground">
                          {formatLatency(result.scores.latency_ms)}
                        </p>
                      </div>
                    </div>
                    <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {result.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Scorecard */}
            <div className="border border-border bg-card/40 p-6 backdrop-blur-sm">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                {copy.scorecard}
              </p>
              <h3 className="mt-1 font-heading text-xl font-bold tracking-tight">
                {copy.scorecardHeading}
              </h3>
              <div className="mt-5 space-y-4 text-sm">
                <div className="bg-muted/20 p-4">
                  <p className="font-semibold text-foreground">{copy.above80}</p>
                  <p className="mt-1 text-muted-foreground">{copy.above80Sub}</p>
                </div>
                <div className="bg-muted/20 p-4">
                  <p className="font-semibold text-foreground">
                    {copy.range6079}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {copy.range6079Sub}
                  </p>
                </div>
                <div className="bg-muted/20 p-4">
                  <p className="font-semibold text-foreground">{copy.below60}</p>
                  <p className="mt-1 text-muted-foreground">{copy.below60Sub}</p>
                </div>
              </div>
            </div>

            {/* Live Report Snapshot */}
            <div className="border border-border bg-card/40 p-6 backdrop-blur-sm">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                {copy.liveSnapshot}
              </p>
              <h3 className="mt-1 font-heading text-xl font-bold tracking-tight">
                {copy.liveSnapshotHeading}
              </h3>

              {report?.status === "ok" ? (
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between bg-muted/20 px-4 py-3">
                    <span className="text-muted-foreground">
                      {copy.recordedQueries}
                    </span>
                    <span className="font-semibold text-foreground">
                      {report.total_queries}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-muted/20 px-4 py-3">
                    <span className="text-muted-foreground">
                      {copy.p95Latency}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatLatency(report.latency?.p95_ms ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-muted/20 px-4 py-3">
                    <span className="text-muted-foreground">
                      {copy.aboveThreshold}
                    </span>
                    <span className="font-semibold text-foreground">
                      {report.retrieval?.pct_above_threshold ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-muted/20 px-4 py-3">
                    <span className="text-muted-foreground">
                      {copy.simpleLanguage}
                    </span>
                    <span className="font-semibold text-foreground">
                      {report.readability?.pct_simple_language ?? 0}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-5 border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                  {copy.noReport}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
