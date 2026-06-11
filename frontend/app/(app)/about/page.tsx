"use client"

import type { ComponentType } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  FileText,
  BarChart3,
  Zap,
  ArrowRight,
  ChevronRight,
  Server,
  Layout,
  BookOpen,
  Check,
  Layers,
  MessageSquare,
  Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  BACKEND_STACK,
  BACKEND_STACK_MS,
  FRONTEND_STACK,
  FRONTEND_STACK_MS,
  API_ENDPOINTS,
  API_ENDPOINTS_MS,
  METHOD_COLORS,
  EVAL_METRICS,
  EVAL_METRICS_MS,
  INGESTION_STEPS,
  INGESTION_STEPS_MS,
  QA_STEPS,
  QA_STEPS_MS,
  KEY_FEATURES,
  KEY_FEATURES_MS,
} from "./data"
import { useLanguage } from "@/components/language-provider"

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionAnchor({ id }: { id: string }) {
  return <span id={id} className="-mt-20 block pt-20" aria-hidden />
}

function SectionHeader({
  icon: Icon,
  label,
  badge,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  badge?: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h2 className="font-heading text-lg font-bold text-foreground sm:text-xl">
        {label}
      </h2>
      {badge && (
        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
          {badge}
        </Badge>
      )}
    </div>
  )
}

function PipelineStep({
  n,
  title,
  items,
  icon: Icon,
  last = false,
}: {
  n: string
  title: string
  items: string[]
  icon: ComponentType<{ className?: string }>
  last?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary/20 bg-primary/8 text-sm font-bold text-primary">
          {n}
        </div>
        {!last && <div className="mt-1 w-px flex-1 bg-border/50" />}
      </div>
      <div className={cn("min-w-0 flex-1 pb-5", last && "pb-0")}>
        <div className="mb-1.5 flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary/60" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function StackCard({ name, role, color, what, why }: {
  name: string; role: string; color: string; what: string; why: string
}) {
  const { language } = useLanguage()
  const whatLabel = language === "ms" ? "Apa: " : "What: "
  const whyLabel = language === "ms" ? "Kenapa: " : "Why: "

  return (
    <Card className="border-border/60 bg-card/40 transition-all hover:border-primary/20">
      <CardHeader className="pb-2 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-sm font-semibold text-foreground">{name}</span>
          <Badge className={cn("border text-[10px] font-medium", color)}>{role}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">{whatLabel}</span>{what}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-primary/80">{whyLabel}</span>{why}
        </p>
      </CardContent>
    </Card>
  )
}

function MetricCard({ name, icon: Icon, what, detail, range }: {
  name: string; icon: ComponentType<{ className?: string }>; what: string; detail: string; range: string
}) {
  return (
    <Card className="border-border/60 bg-card/40">
      <CardContent className="pb-4 pt-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-primary/60" />
            <span className="text-sm font-semibold text-foreground">{name}</span>
          </div>
          <Badge variant="outline" className="shrink-0 border-border/60 font-mono text-[10px] text-muted-foreground">
            {range}
          </Badge>
        </div>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{what}</p>
        <p className="border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const { language } = useLanguage()

  const copy = language === "ms"
    ? {
        badge: "Rujukan Teknikal",
        heading: "Cara Lingua Rakyat Berfungsi",
        subtitle: "Rujukan seni bina — saluran pengambilan, sistem S&J, timbunan teknologi, API, dan metrik penilaian.",

        // Overview
        overviewLabel: "Gambaran Projek",
        problemTitle: "Masalah",
        problemItems: [
          "PDF kerajaan ditulis dalam bahasa undang-undang — bukan bahasa mudah",
          "Dokumen panjang tiada antara muka soal jawab boleh cari",
          "Tiada akses saksama untuk penutur Melayu, Inggeris, dan Cina",
          "Kriteria kelayakan tersembunyi dalam perenggan",
        ],
        solutionTitle: "Penyelesaian",
        solutionItems: [
          "Muat naik mana-mana PDF kerajaan — boleh ditanya serta-merta",
          "Tanya dalam Melayu, Inggeris, atau Mandarin — jawapan dalam bahasa sama",
          "Setiap jawapan berpunca daripada teks dokumen dengan petikan halaman",
          "Penjaga bukti menolak halusinasi — menunjukkan keyakinan",
        ],
        ragLabel: "RAG dalam satu ayat: ",
        ragText: "Berbanding LLM yang meneka daripada ingatan latihan, Lingua Rakyat terlebih dahulu mencari petikan berkaitan dalam dokumen sebenar, kemudian menghantar hanya petikan itu kepada LLM — supaya jawapan sentiasa boleh dikesan kepada sumber nyata.",

        // Ingestion pipeline
        ingestionLabel: "Saluran Pengambilan",
        ingestionBadge: "Fasa 1",
        ingestionDesc: "Dicetuskan sekali apabila PDF dimuat naik. Berjalan luar talian — pengguna boleh mula bertanya soalan sebaik sahaja pengambilan selesai.",

        // Q&A pipeline
        qaLabel: "Saluran S&J",
        qaBadge: "Fasa 2",
        qaDesc: "Dicetuskan setiap soalan. Aliran token ke UI semasa dijana — token pertama muncul dalam ~600ms pada cache hangat.",

        // API
        apiLabel: "Rujukan API",
        apiDesc: "Semua titik akhir dihadkan kadar setiap IP melalui SlowAPI. Dokumen interaktif di",
        apiDescSuffix: "(Swagger UI).",
        colMethod: "Kaedah",
        colPath: "Laluan",
        colDesc: "Penerangan",

        // Tech Stack
        techLabel: "Timbunan Teknologi",
        techBackend: "Backend",
        techFrontend: "Frontend & Penempatan",

        // Key Features
        featuresLabel: "Ciri Utama",

        // Eval Metrics
        metricsLabel: "Metrik Penilaian",
        metricsDesc: "Semua metrik dikira secara dalaman dalam",
        metricsDescSuffix: ". Tiada API penilaian luaran.",

        // Footer
        footerNote: "Nota:",
        footerText: "Halaman ini mencerminkan keadaan kod semasa penghantaran RISE 2026. Backend dihoskan di Render (peringkat percuma, 512 MB RAM). Frontend di Vercel. Sumber:",
      }
    : {
        badge: "Technical Reference",
        heading: "How Lingua Rakyat Works",
        subtitle: "Architecture reference — ingestion pipeline, Q&A system, tech stack, API, and eval metrics.",

        overviewLabel: "Project Overview",
        problemTitle: "The Problem",
        problemItems: [
          "Government PDFs written in legalese — not plain language",
          "Long documents with no searchable Q&A interface",
          "No equal access across Malay, English, and Chinese speakers",
          "Eligibility criteria buried in paragraphs",
        ],
        solutionTitle: "The Solution",
        solutionItems: [
          "Upload any government PDF — queryable instantly",
          "Ask in Malay, English, or Mandarin — answer in same language",
          "Every answer grounded in document text with page citations",
          "Evidence guard refuses to hallucinate — shows confidence",
        ],
        ragLabel: "RAG in one sentence: ",
        ragText: "Instead of an LLM guessing from training memory, Lingua Rakyat first searches the actual document for relevant passages, then passes only those passages to the LLM — so the answer is always traceable to a real source.",

        ingestionLabel: "Ingestion Pipeline",
        ingestionBadge: "Phase 1",
        ingestionDesc: "Triggered once when a PDF is uploaded. Runs offline — users can start asking questions as soon as ingestion completes.",

        qaLabel: "Q&A Pipeline",
        qaBadge: "Phase 2",
        qaDesc: "Triggered per question. Streams tokens to the UI as they're generated — first token appears within ~600ms on a warm cache.",

        apiLabel: "API Reference",
        apiDesc: "All endpoints rate-limited per IP via SlowAPI. Interactive docs at",
        apiDescSuffix: "(Swagger UI).",
        colMethod: "Method",
        colPath: "Path",
        colDesc: "Description",

        techLabel: "Tech Stack",
        techBackend: "Backend",
        techFrontend: "Frontend & Deployment",

        featuresLabel: "Key Features",

        metricsLabel: "Evaluation Metrics",
        metricsDesc: "All metrics computed in-house in",
        metricsDescSuffix: ". No external eval APIs.",

        footerNote: "Note:",
        footerText: "This page reflects the live codebase state as of the RISE 2026 submission. Backend hosted on Render (free tier, 512 MB RAM). Frontend on Vercel. Source:",
      }

  const isMalay = language === "ms"
  const backendStack    = isMalay ? BACKEND_STACK_MS    : BACKEND_STACK
  const frontendStack   = isMalay ? FRONTEND_STACK_MS   : FRONTEND_STACK
  const apiEndpoints    = isMalay ? API_ENDPOINTS_MS    : API_ENDPOINTS
  const evalMetrics     = isMalay ? EVAL_METRICS_MS     : EVAL_METRICS
  const ingestionSteps  = isMalay ? INGESTION_STEPS_MS  : INGESTION_STEPS
  const qaSteps         = isMalay ? QA_STEPS_MS         : QA_STEPS
  const keyFeatures     = isMalay ? KEY_FEATURES_MS     : KEY_FEATURES

  return (
    <ScrollArea className="h-full">
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">

          {/* ── Page header ── */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="border-primary/20 bg-primary/8 text-primary">
                {copy.badge}
              </Badge>
              <Badge variant="outline" className="border-border/60 text-muted-foreground">
                v2.0.0
              </Badge>
            </div>
            <h1 className="font-heading text-xl font-black tracking-tight text-foreground sm:text-2xl">
              {copy.heading}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>

          {/* ── 2-column body ── */}
          <div className="grid gap-6 xl:grid-cols-2">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-6">

              {/* Overview */}
              <section className="border border-border bg-card">
                <SectionAnchor id="overview" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={BookOpen} label={copy.overviewLabel} />
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card className="border-border/60 bg-card/40">
                      <CardContent className="pb-4 pt-4">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center bg-red-500/10">
                            <FileText className="h-3.5 w-3.5 text-red-500" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">{copy.problemTitle}</span>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {copy.problemItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/40">
                      <CardContent className="pb-4 pt-4">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center bg-primary/10">
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">{copy.solutionTitle}</span>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {copy.solutionItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="border border-primary/15 bg-primary/5 px-4 py-3">
                    <p className="text-sm text-foreground/80">
                      <span className="font-semibold text-primary">{copy.ragLabel}</span>
                      {copy.ragText}
                    </p>
                  </div>
                </div>
              </section>

              {/* Ingestion Pipeline */}
              <section className="border border-border bg-card">
                <SectionAnchor id="ingestion" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={Upload} label={copy.ingestionLabel} badge={copy.ingestionBadge} />
                  <p className="text-xs text-muted-foreground">
                    {copy.ingestionDesc}
                  </p>
                </div>
                <div className="p-5">
                  {ingestionSteps.map((step, i) => (
                    <PipelineStep
                      key={step.n}
                      n={step.n}
                      title={step.title}
                      icon={step.icon}
                      items={step.items}
                      last={i === ingestionSteps.length - 1}
                    />
                  ))}
                </div>
              </section>

              {/* Q&A Pipeline */}
              <section className="border border-border bg-card">
                <SectionAnchor id="qa-pipeline" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={MessageSquare} label={copy.qaLabel} badge={copy.qaBadge} />
                  <p className="text-xs text-muted-foreground">
                    {copy.qaDesc}
                  </p>
                </div>
                <div className="p-5">
                  {qaSteps.map((step, i) => (
                    <PipelineStep
                      key={step.n}
                      n={step.n}
                      title={step.title}
                      icon={step.icon}
                      items={step.items}
                      last={i === qaSteps.length - 1}
                    />
                  ))}
                </div>
              </section>

              {/* API Reference */}
              <section className="border border-border bg-card">
                <SectionAnchor id="api" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={Server} label={copy.apiLabel} />
                  <p className="text-xs text-muted-foreground">
                    {copy.apiDesc}{" "}
                    <code className="bg-muted/40 px-1 font-mono text-[11px] text-foreground">/docs</code>{" "}
                    {copy.apiDescSuffix}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="w-16 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{copy.colMethod}</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{copy.colPath}</th>
                        <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:table-cell">{copy.colDesc}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {apiEndpoints.map((ep) => (
                        <tr key={ep.path} className="hover:bg-muted/10">
                          <td className="px-4 py-2.5">
                            <Badge className={cn("border font-mono text-[10px] font-semibold", METHOD_COLORS[ep.method])}>
                              {ep.method}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <code className="font-mono text-xs text-foreground/80">{ep.path}</code>
                          </td>
                          <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">
                            {ep.desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-6">

              {/* Tech Stack */}
              <section className="border border-border bg-card">
                <SectionAnchor id="tech-stack" />
                <div className="border-b border-border px-5 py-4">
                  <SectionHeader icon={Layers} label={copy.techLabel} />
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      <Server className="h-3.5 w-3.5" />
                      {copy.techBackend}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {backendStack.map((tech) => (
                        <StackCard key={tech.name} {...tech} />
                      ))}
                    </div>
                  </div>
                  <Separator className="bg-border/50" />
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      <Layout className="h-3.5 w-3.5" />
                      {copy.techFrontend}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {frontendStack.map((tech) => (
                        <StackCard key={tech.name} {...tech} />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </div>

          {/* ── Key Features + Eval Metrics side by side ── */}
          <div className="grid gap-6 xl:grid-cols-2">

            {/* Key Features */}
            <section className="border border-border bg-card">
              <SectionAnchor id="features" />
              <div className="border-b border-border px-5 py-4">
                <SectionHeader icon={Zap} label={copy.featuresLabel} />
              </div>
              <div className="p-5 space-y-3">
                {keyFeatures.map((feat) => (
                  <Card key={feat.label} className="border-border/60 bg-card/40">
                    <CardContent className="pb-3 pt-3">
                      <div className="mb-2 flex items-center gap-2">
                        <div className={cn("flex h-6 w-6 items-center justify-center", feat.bg)}>
                          <feat.icon className={cn("h-3.5 w-3.5", feat.color)} />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{feat.label}</span>
                      </div>
                      <ul className="space-y-1">
                        {feat.points.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary/40" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Eval Metrics */}
            <section className="border border-border bg-card">
              <SectionAnchor id="metrics" />
              <div className="border-b border-border px-5 py-4">
                <SectionHeader icon={BarChart3} label={copy.metricsLabel} />
                <p className="text-xs text-muted-foreground">
                  {copy.metricsDesc}{" "}
                  <code className="bg-muted/40 px-1 font-mono text-[11px] text-foreground">utils/evaluation.py</code>
                  {copy.metricsDescSuffix}
                </p>
              </div>
              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {evalMetrics.map((m) => (
                    <MetricCard key={m.name} {...m} />
                  ))}
                </div>
              </div>
            </section>

          </div>

          {/* Footer note */}
          <div className="border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{copy.footerNote}</span>{" "}
            {copy.footerText}{" "}
            <code className="bg-muted/40 px-1 font-mono">github.com/apiz23/lingua-rakyat</code>
          </div>

        </main>
      </div>
    </ScrollArea>
  )
}
