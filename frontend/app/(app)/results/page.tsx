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
  ArrowRight,
  Loader2,
  Zap,
} from "lucide-react"
import { getEvalReport, type EvalReport } from "@/lib/api"
import { useLanguage } from "@/components/language-provider"

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
  const { language } = useLanguage()
  const [report, setReport] = useState<EvalReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEvalReport()
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const copy = language === "ms"
    ? {
        eyebrow: "Lingua Rakyat · RISE 2026",
        heading: "Pameran Projek",
        subtitle: "Memperluas Akses kepada Perkhidmatan Kerajaan Melalui AI Pelbagai Bahasa. Metrik langsung diambil daripada sistem penilaian secara masa nyata.",
        loadingMetrics: "Memuatkan metrik langsung…",
        liveQueries: (n: number) => `Langsung — ${n} pertanyaan direkodkan`,
        // Quick links
        quickLinksWorkspaceTitle: "Ruang Kerja",
        quickLinksWorkspaceDesc: "Muat naik PDF dan tanya soalan dalam Bahasa Melayu, Inggeris, atau Cina.",
        quickLinksWorkspaceBtn: "Buka Ruang Kerja",
        quickLinksDocsTitle: "Dokumen",
        quickLinksDocsDesc: "Muat naik, namakan semula, atau padam dokumen PDF kerajaan.",
        quickLinksDocsBtn: "Urus Dokumen",
        quickLinksEvalTitle: "Penilaian",
        quickLinksEvalDesc: "Jalankan suite ujian ROUGE/BLEU dan lihat skor penanda aras langsung.",
        quickLinksEvalBtn: "Papan Pemuka Penilaian",
        // Metrics section
        qualityMetricsEyebrow: "Metrik Kualiti",
        qualityMetricsHeading: "Metrik Prestasi Langsung",
        metricRougeTitle: "ROUGE-1 F1",
        metricRougeDesc: "Pertindihan perkataan berbanding jawapan rujukan. Julat RAG biasa: 0.10–0.30.",
        metricBleuTitle: "Skor BLEU",
        metricBleuDesc: "Ketepatan n-gram berbanding jawapan rujukan.",
        metricReadabilityTitle: "Kebolehbacaan",
        metricReadabilityDesc: "Tahap gred Flesch-Kincaid. Lebih rendah = lebih mudah dibaca.",
        metricConfidenceTitle: "Keyakinan Carian",
        metricConfidenceDesc: "Skor purata selepas pemeringkatan semula merentas semua pertanyaan.",
        metricFaithfulTitle: "Kesetiaan Sumber",
        metricFaithfulDesc: "Sejauh mana jawapan berpunca daripada dokumen sumber (pemeringkat semula Cohere).",
        metricLatencyTitle: "Kependaman",
        metricLatencyDesc: "Kependaman respons hujung ke hujung (carian + pemeringkatan + penjanaan).",
        runBenchmark: "Jalankan penanda aras →",
        askQuestions: "Tanya soalan untuk markah →",
        // Feature checklist
        featuresEyebrow: "Senarai Semak Ciri",
        featuresHeading: "Keupayaan Sistem",
        fulfilled: "TERPENUHI",
        features: [
          { title: "RAG Pelbagai Bahasa", desc: "Cohere embed-multilingual-v3 — carian pada tahap pembenaman, bukan melalui terjemahan. EN / MS / ZH." },
          { title: "Pemeringkatan Semula Neural", desc: "Cohere rerank-multilingual-v3 pemeringkatan silang menilai semula k-chunk teratas sebelum penjanaan." },
          { title: "Pengembangan Multi-Pertanyaan", desc: "Soalan dikembangkan kepada ×4 varian bahasa sebelum carian untuk meningkatkan penarikan silang bahasa." },
          { title: "Penjaga Bukti (anti-halusinasi)", desc: "Menolak untuk menjana apabila bukti yang diambil semula di bawah ambang keyakinan." },
          { title: "Pemarkahan Kesetiaan", desc: "Skor pengikatan setiap jawapan (pemeringkat semula Cohere: jawapan vs chunk sumber). Ditunjukkan dalam UI sembang." },
          { title: "Pemotongan Peka Bahagian", desc: "Chunk 360 patah perkataan dengan pertindihan 45 patah; mengesan pengepala bahagian untuk memelihara struktur dokumen." },
          { title: "Suara I/O", desc: "Groq Whisper STT untuk input suara. ElevenLabs TTS + fallback speechSynthesis pelayar untuk output audio." },
          { title: "Konteks Berbilang Giliran", desc: "3 giliran S&J terakhir dihantar sebagai konteks supaya soalan susulan (cth. 'ceritakan lagi') berfungsi dengan betul." },
          { title: "Cadangan Susulan", desc: "Selepas setiap jawapan, 3 soalan susulan kontekstual dicadangkan dan boleh diklik." },
          { title: "Penonton PDF + Pautan Petikan", desc: "Klik mana-mana pil sumber → menyerlahkan petikan dalam panel PDF dalam aplikasi." },
          { title: "Papan Pemuka Penilaian", desc: "ROUGE-1/2/L, BLEU, Flesch-Kincaid, kesetiaan — dialirkan langsung daripada suite ujian beranotasi." },
          { title: "Pengehadan Kadar + BOOTH_MODE", desc: "Pengehadan kadar SlowAPI per-IP. BOOTH_MODE=true melonggarkan had untuk demo WiFi dikongsi." },
          { title: "Kebolehaksesan (Atkinson Hyperlegible)", desc: "Fon badan direka untuk pengguna penglihatan rendah. Suara I/O untuk akses utama audio." },
          { title: "Cache Fallback Luar Talian", desc: "Petikan S&J terdahulu dicache dalam localStorage; dicetuskan secara automatik apabila rangkaian tidak tersedia." },
        ],
        // SDG
        sdgEyebrow: "Impak Sosial",
        sdgHeading: "Penjajaran SDG",
        sdgs: [
          { sdg: "16", label: "Keamanan, Keadilan & Institusi Kukuh", desc: "Maklumat kerajaan yang telus dan boleh disahkan untuk setiap warganegara tanpa mengira bahasa, latar belakang, atau tahap literasi." },
          { sdg: "10", label: "Pengurangan Ketidaksamaan", desc: "Akses pelbagai bahasa menghapuskan halangan untuk penutur Melayu, Cina, dan Inggeris dalam satu platform bersatu." },
          { sdg: "4",  label: "Pendidikan Berkualiti", desc: "Memperkasakan warganegara untuk memahami hak undang-undang, hak, dan kewajipan sivik melalui jawapan yang berasas dalam bahasa mudah." },
        ],
        // Footer stats
        statMalaysians: "warganegara Malaysia boleh dicapai",
        statLanguages: "bahasa disokong",
        statCost: "Kos kepada warganegara",
        statReading: "Sasaran tahap bacaan",
      }
    : {
        eyebrow: "Lingua Rakyat · RISE 2026",
        heading: "Project Showcase",
        subtitle: "Democratizing Access to Government Services Through Multilingual AI. Live metrics pull from the evaluation backend in real time.",
        loadingMetrics: "Loading live metrics…",
        liveQueries: (n: number) => `Live — ${n} queries recorded`,
        quickLinksWorkspaceTitle: "Workspace",
        quickLinksWorkspaceDesc: "Upload a PDF and ask questions in Malay, English, or Chinese.",
        quickLinksWorkspaceBtn: "Open Workspace",
        quickLinksDocsTitle: "Documents",
        quickLinksDocsDesc: "Upload, rename, or delete government PDF documents.",
        quickLinksDocsBtn: "Manage Documents",
        quickLinksEvalTitle: "Evaluation",
        quickLinksEvalDesc: "Run ROUGE/BLEU test suite and view live benchmark scores.",
        quickLinksEvalBtn: "Evaluation Dashboard",
        qualityMetricsEyebrow: "Quality Metrics",
        qualityMetricsHeading: "Live Performance Metrics",
        metricRougeTitle: "ROUGE-1 F1",
        metricRougeDesc: "Word overlap vs ground truth answers. Normal RAG range: 0.10–0.30.",
        metricBleuTitle: "BLEU Score",
        metricBleuDesc: "N-gram precision vs reference answers.",
        metricReadabilityTitle: "Readability",
        metricReadabilityDesc: "Flesch-Kincaid grade level. Lower = easier to read.",
        metricConfidenceTitle: "Retrieval Confidence",
        metricConfidenceDesc: "Mean reranked score across all queries.",
        metricFaithfulTitle: "Faithfulness",
        metricFaithfulDesc: "How grounded answers are in the source document (Cohere reranker).",
        metricLatencyTitle: "Latency",
        metricLatencyDesc: "End-to-end response latency (retrieval + reranking + generation).",
        runBenchmark: "Run benchmark →",
        askQuestions: "Ask questions to score →",
        featuresEyebrow: "Feature Checklist",
        featuresHeading: "System Capabilities",
        fulfilled: "FULFILLED",
        features: [
          { title: "Multilingual RAG", desc: "Cohere embed-multilingual-v3 — retrieval at embedding level, not via translation. EN / MS / ZH." },
          { title: "Neural Reranking", desc: "Cohere rerank-multilingual-v3 cross-encoder re-scores top-k chunks before generation." },
          { title: "Multi-Query Augmentation", desc: "Question expanded to ×4 language variants before retrieval to improve cross-lingual recall." },
          { title: "Evidence Guard (anti-hallucination)", desc: "Refuses to generate when retrieved evidence is below the confidence threshold." },
          { title: "Faithfulness Scoring", desc: "Per-answer grounding score (Cohere reranker: answer vs source chunks). Shown in chat UI." },
          { title: "Section-Aware Chunking", desc: "360-word chunks with 45-word overlap; detects section headers to preserve document structure." },
          { title: "Voice I/O", desc: "Groq Whisper STT for voice input. ElevenLabs TTS + browser speechSynthesis fallback for audio output." },
          { title: "Multi-Turn Context", desc: "Last 3 Q&A turns passed as context so follow-up questions (e.g. 'tell me more') work correctly." },
          { title: "Suggested Follow-ups", desc: "After each answer, 3 contextual follow-up questions are suggested and clickable." },
          { title: "PDF Viewer + Citation Linking", desc: "Click any source pill → highlights the passage in the in-app PDF panel." },
          { title: "Evaluation Dashboard", desc: "ROUGE-1/2/L, BLEU, Flesch-Kincaid, faithfulness — streamed live from annotated test suite." },
          { title: "Rate Limiting + BOOTH_MODE", desc: "SlowAPI per-IP rate limiting. BOOTH_MODE=true lifts limits for shared WiFi demo." },
          { title: "Accessibility (Atkinson Hyperlegible)", desc: "Body font designed for low-vision users. Voice I/O for audio-first access." },
          { title: "Offline Fallback Cache", desc: "Prior Q&A excerpts cached in localStorage; auto-triggers when network is unavailable." },
        ],
        sdgEyebrow: "Social Impact",
        sdgHeading: "SDG Alignment",
        sdgs: [
          { sdg: "16", label: "Peace, Justice & Strong Institutions", desc: "Transparent, verifiable government information for every citizen regardless of language, background, or literacy level." },
          { sdg: "10", label: "Reduced Inequalities", desc: "Multilingual access removes barriers for Malay, Chinese, and English speakers in a single unified platform." },
          { sdg: "4",  label: "Quality Education", desc: "Empowers citizens to understand legal rights, entitlements, and civic obligations through grounded, plain-language answers." },
        ],
        statMalaysians: "Malaysians addressable",
        statLanguages: "Languages supported",
        statCost: "Cost to citizens",
        statReading: "Reading level target",
      }

  const hasMetrics = report?.status === "ok" && (report.total_queries ?? 0) > 0

  const rougeVal = hasMetrics && report!.generation_quality
    ? report!.generation_quality.avg_rouge1_f1.toFixed(3)
    : copy.runBenchmark
  const bleuVal = hasMetrics && report!.generation_quality
    ? report!.generation_quality.avg_bleu.toFixed(3)
    : copy.runBenchmark
  const readabilityVal = hasMetrics
    ? `${report!.readability.avg_fk_grade.toFixed(1)} (target ≤ 6)`
    : "Target ≤ 6"
  const confidenceVal = hasMetrics
    ? `${pct(report!.retrieval.avg_confidence)} (target ≥ 50%)`
    : "Target ≥ 50%"
  const faithfulnessVal = hasMetrics && (report!.faithfulness?.scored_queries ?? 0) > 0
    ? `${pct(report!.faithfulness!.avg_faithfulness_score)} (${report!.faithfulness!.scored_queries} scored)`
    : copy.askQuestions
  const latencyVal = hasMetrics
    ? `p50 ${report!.latency.p50_ms}ms · p95 ${report!.latency.p95_ms}ms`
    : "Target < 3s"

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* Header */}
      <div className="mb-10">
        <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mb-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          {copy.heading}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {copy.subtitle}
        </p>
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {copy.loadingMetrics}
          </div>
        )}
        {!loading && hasMetrics && (
          <div className="mt-3 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {copy.liveQueries(report!.total_queries)}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        <div className="border border-primary/20 bg-primary/5 p-5">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-semibold text-foreground">{copy.quickLinksWorkspaceTitle}</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{copy.quickLinksWorkspaceDesc}</p>
          <Button asChild className="w-full">
            <Link href="/workspace">{copy.quickLinksWorkspaceBtn} <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-semibold text-foreground">{copy.quickLinksDocsTitle}</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{copy.quickLinksDocsDesc}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/manage">{copy.quickLinksDocsBtn} <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-semibold text-foreground">{copy.quickLinksEvalTitle}</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{copy.quickLinksEvalDesc}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/eval">{copy.quickLinksEvalBtn} <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* Live quality metrics */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        {copy.qualityMetricsEyebrow}
      </p>
      <h2 className="mb-5 flex items-center font-heading text-2xl font-semibold text-foreground">
        <Target className="mr-2 h-5 w-5 text-primary" />
        {copy.qualityMetricsHeading}
      </h2>
      <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard title={copy.metricRougeTitle} value={rougeVal} description={copy.metricRougeDesc} icon={<BookOpen className="h-4 w-4" />} live={hasMetrics && !!report!.generation_quality} />
        <MetricCard title={copy.metricBleuTitle} value={bleuVal} description={copy.metricBleuDesc} icon={<Globe2 className="h-4 w-4" />} live={hasMetrics && !!report!.generation_quality} />
        <MetricCard title={copy.metricReadabilityTitle} value={readabilityVal} description={copy.metricReadabilityDesc} icon={<BookOpen className="h-4 w-4" />} live={hasMetrics} />
        <MetricCard title={copy.metricConfidenceTitle} value={confidenceVal} description={copy.metricConfidenceDesc} icon={<ShieldCheck className="h-4 w-4" />} live={hasMetrics} />
        <MetricCard title={copy.metricFaithfulTitle} value={faithfulnessVal} description={copy.metricFaithfulDesc} icon={<ShieldCheck className="h-4 w-4" />} live={hasMetrics && (report!.faithfulness?.scored_queries ?? 0) > 0} />
        <MetricCard title={copy.metricLatencyTitle} value={latencyVal} description={copy.metricLatencyDesc} icon={<Zap className="h-4 w-4" />} live={hasMetrics} />
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* Feature checklist */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        {copy.featuresEyebrow}
      </p>
      <h2 className="mb-5 flex items-center font-heading text-2xl font-semibold text-foreground">
        <CheckCircle2 className="mr-2 h-5 w-5 text-primary" />
        {copy.featuresHeading}
      </h2>
      <div className="mb-10 border border-border bg-card">
        <div className="divide-y divide-border">
          {copy.features.map((f) => (
            <ComplianceRow key={f.title} title={f.title} description={f.desc} status={copy.fulfilled} />
          ))}
        </div>
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* SDG Impact */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        {copy.sdgEyebrow}
      </p>
      <h2 className="mb-5 flex items-center font-heading text-2xl font-semibold text-foreground">
        <Globe2 className="mr-2 h-5 w-5 text-primary" />
        {copy.sdgHeading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {copy.sdgs.map(({ sdg, label, desc }) => (
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
          { value: "33M+", label: copy.statMalaysians },
          { value: "3", label: copy.statLanguages },
          { value: "$0", label: copy.statCost },
          { value: "≤ 6th", label: copy.statReading },
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
