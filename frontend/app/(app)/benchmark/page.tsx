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
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </p>
        <div className="rounded-xl bg-primary/10 p-2">
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {copy.refresh}
            </button>
          }
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  {copy.title}
                </h1>
                <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
                {copy.refresh}
              </button>
            </div>
          </div>
        </PageIntro>

        <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                {copy.runTag}
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
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
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Skor Benchmark"
            value={`${overallScore}/100`}
            sub="Skor berwajaran dari kualiti, keyakinan, kebolehbacaan, dan kelajuan"
            icon={Target}
          />
          <MetricCard
            label="ROUGE-1"
            value={score(
              aggregate?.avg_rouge1_f1 ??
                report?.generation_quality?.avg_rouge1_f1 ??
                0
            )}
            sub="Padanan jawapan dengan rujukan benchmark"
            icon={Sparkles}
          />
          <MetricCard
            label="Confidence"
            value={pct(
              aggregate?.avg_confidence ??
                report?.retrieval?.avg_confidence ??
                0
            )}
            sub="Purata keyakinan carian"
            icon={ShieldCheck}
          />
          <MetricCard
            label="Readability"
            value={(
              aggregate?.avg_fk_grade ??
              report?.readability?.avg_fk_grade ??
              0
            ).toFixed(1)}
            sub="Lebih rendah lebih mudah dibaca"
            icon={CheckCircle2}
          />
          <MetricCard
            label="Latency"
            value={formatLatency(
              aggregate?.avg_latency_ms ?? report?.latency?.avg_ms ?? 0
            )}
            sub="Purata masa respons"
            icon={Clock3}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                  Keputusan Terkini
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight">
                  Output benchmark per kes
                </h3>
              </div>
              {aggregate && (
                <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  {aggregate.cases_run} kes dijalankan
                </span>
              )}
            </div>

            {!testResult ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 text-center">
                <div className="space-y-3 px-6">
                  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="font-medium text-foreground">
                    Belum ada benchmark dijalankan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pilih dokumen yang sedia dan jalankan benchmark untuk
                    mengisi halaman ini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {testResult.results.map((result) => (
                  <div
                    key={`${result.case_index}-${result.question}`}
                    className="rounded-2xl border border-border/60 bg-background p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">
                        {result.question}
                      </p>
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        {result.language}
                      </span>
                    </div>
                    <div className="mb-3 grid gap-2 sm:grid-cols-4">
                      <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">ROUGE-1</span>
                        <p className="mt-1 font-mono text-foreground">
                          {score(result.scores.rouge1_f1)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">BLEU</span>
                        <p className="mt-1 font-mono text-foreground">
                          {score(result.scores.bleu)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">
                          Confidence
                        </span>
                        <p className="mt-1 font-mono text-foreground">
                          {pct(result.scores.confidence)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs">
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
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                Scorecard
              </p>
              <h3 className="mt-1 text-xl font-bold tracking-tight">
                What the benchmark means
              </h3>
              <div className="mt-5 space-y-4 text-sm">
                <div className="rounded-2xl bg-muted/20 p-4">
                  <p className="font-semibold text-foreground">Above 80</p>
                  <p className="mt-1 text-muted-foreground">
                    Strong competition-ready benchmark profile with balanced
                    quality and usability.
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/20 p-4">
                  <p className="font-semibold text-foreground">60 to 79</p>
                  <p className="mt-1 text-muted-foreground">
                    Good foundation, but still room to improve answer quality or
                    simplicity.
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/20 p-4">
                  <p className="font-semibold text-foreground">Below 60</p>
                  <p className="mt-1 text-muted-foreground">
                    Retrieval confidence, benchmark truth overlap, or prompt
                    quality needs work.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                Live Report Snapshot
              </p>
              <h3 className="mt-1 text-xl font-bold tracking-tight">
                Stored evaluation metrics
              </h3>

              {report?.status === "ok" ? (
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
                    <span className="text-muted-foreground">
                      Recorded queries
                    </span>
                    <span className="font-semibold text-foreground">
                      {report.total_queries}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
                    <span className="text-muted-foreground">P95 latency</span>
                    <span className="font-semibold text-foreground">
                      {formatLatency(report.latency?.p95_ms ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
                    <span className="text-muted-foreground">
                      Above threshold
                    </span>
                    <span className="font-semibold text-foreground">
                      {report.retrieval?.pct_above_threshold ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
                    <span className="text-muted-foreground">
                      Simple language rate
                    </span>
                    <span className="font-semibold text-foreground">
                      {report.readability?.pct_simple_language ?? 0}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                  No stored evaluation report yet. Run a benchmark or use the
                  app to generate metrics.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
