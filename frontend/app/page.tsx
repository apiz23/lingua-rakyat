"use client"

import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Shield,
  Globe,
  Mic,
  FileSearch,
  Languages,
  BarChart3,
  Play,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import Footer from "@/components/footer"
import LogoCarousel from "@/components/ui/logo-carousel"
import { useMobile } from "@/hooks/use-mobile"
import { useLanguage } from "@/components/language-provider"
import { useTheme } from "next-themes"
import { LinkPreview } from "@/components/ui/link-preview"
import {
  MediaPlayer,
  MediaPlayerVideo,
  MediaPlayerControls,
  MediaPlayerControlsOverlay,
  MediaPlayerPlay,
  MediaPlayerSeekBackward,
  MediaPlayerSeekForward,
  MediaPlayerVolume,
  MediaPlayerSeek,
  MediaPlayerTime,
  MediaPlayerPlaybackSpeed,
  MediaPlayerFullscreen,
  MediaPlayerPiP,
} from "@/components/ui/media-player"
import logo from "@/public/icons/android-chrome-512x512.png"
import { useRef } from "react"
import {
  HeroLiquidMetalMobileVisual,
  HeroLiquidMetalRoot,
  HeroLiquidMetalVisual,
} from "@/components/ui/hero-liquid-metal"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/mode-toggle"

const ease = [0.23, 1, 0.32, 1] as const

function FadeInUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef(null)
  const shouldReduce = useReducedMotion()
  const isInView = useInView(ref, { once: false, amount: 0.2, margin: "-40px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
      animate={{
        opacity: isInView ? 1 : 0,
        y: isInView ? 0 : shouldReduce ? 0 : 24,
      }}
      transition={{ duration: 0.55, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function FadeInLeft({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef(null)
  const shouldReduce = useReducedMotion()
  const isInView = useInView(ref, { once: false, amount: 0.2, margin: "-40px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: shouldReduce ? 0 : -20 }}
      animate={{
        opacity: isInView ? 1 : 0,
        x: isInView ? 0 : shouldReduce ? 0 : -20,
      }}
      transition={{ duration: 0.5, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function ScaleIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const ref = useRef(null)
  const shouldReduce = useReducedMotion()
  const isInView = useInView(ref, {
    once: false,
    amount: 0.15,
    margin: "-40px",
  })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.95 }}
      animate={{
        opacity: isInView ? 1 : 0,
        scale: isInView ? 1 : shouldReduce ? 1 : 0.95,
      }}
      transition={{ duration: 0.5, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  const { language, toggleLanguage } = useLanguage()
  const { theme } = useTheme()
  const isMobile = useMobile()
  const isDark = theme === "dark"
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.8])
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.98])

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
    },
  }

  const copy =
    language === "ms"
      ? {
          kicker: "RAG Multilingual untuk Dokumen Kerajaan",
          headline1: "Retrieval-Augmented",
          headline2: "Generation.",
          subhead:
            "Sistem soal-jawab dokumen kerajaan menggunakan Cohere embeddings, Pinecone vector database, dan Groq LLM. Sokongan penuh untuk Bahasa Melayu, English, dan Mandarin.",
          cta: "Terokai Demo Teknikal",
          ctaSecondary: "Lihat Metrik",
          strip: [
            "🔍 Semantic Search",
            "📊 ROUGE-1/2/L",
            "⚡ Groq Inference",
            "🎯 Confidence Scoring",
          ],
          howItWorks: "Aliran Teknikal",
          steps: [
            {
              n: "01",
              title: "Ingestion",
              desc: "PDF → ekstrak teks → chunking (tetingkap 500 perkataan, overlap 50) → embedding Cohere (multilingual) → Pinecone.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "Embed soalan → carian semantik Pinecone → ambil top-k chunks → augmentasi pertanyaan (pilihan).",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "Bina prompt kontekstual → Groq LLM (Llama 3) → jawapan ringkas + petikan + skor keyakinan.",
              icon: FileSearch,
            },
          ],
          whatItDoes: "Ciri-ciri Utama",
          builtFor:
            "Sistem RAG lengkap dengan papan pemuka penilaian untuk ketelusan penuh.",
          features: [
            {
              label: "Multilingual RAG",
              desc: "Cohere embed-v3 dengan sokongan untuk 100+ bahasa, dirutekan ke output BM, EN, atau zh.",
              icon: Globe,
            },
            {
              label: "Evaluation Suite",
              desc: "ROUGE, BLEU, Flesch-Kincaid, exact match, dan metrik masa nyata.",
              icon: BarChart3,
            },
            {
              label: "Streaming Tests",
              desc: "Jalankan suite ujian dengan hasil langsung dalam papan pemuka /eval.",
              icon: Shield,
            },
            {
              label: "Query Augmentation",
              desc: "Kembangkan soalan ke pelbagai bahasa untuk retrieval yang lebih baik.",
              icon: Mic,
            },
          ],
          watchDemo: "Demonstrasi Teknikal",
          seeItWork: "SIstem sedang memproses dokumen kerajaan",
          builtWith: "Stack Teknologi",
          previewQ: "Query: Siapa yang layak memohon bantuan ini?",
          previewA:
            "Berdasarkan Seksyen 2.1, pemohon mesti warganegara Malaysia berumur 18+ dengan pendapatan isi rumah ≤RM4,000.",
          previewSrc: "Chunk ID: doc_001_chunk_42 | Similarity: 0.89",
        }
      : {
          kicker: "Multilingual RAG for Government Documents",
          headline1: "Retrieval-Augmented",
          headline2: "Generation.",
          subhead:
            "Government document Q&A system using Cohere embeddings, Pinecone vector DB, and Groq LLM. Full support for Malay, English, and Chinese.",
          cta: "Explore Technical Demo",
          ctaSecondary: "View Metrics",
          strip: [
            "🔍 Semantic Search",
            "📊 ROUGE-1/2/L",
            "⚡ Groq Inference",
            "🎯 Confidence Scoring",
          ],
          howItWorks: "Technical Flow",
          steps: [
            {
              n: "01",
              title: "Ingestion",
              desc: "PDF → text extraction → chunking (500 word window, 50 overlap) → Cohere embeddings (multilingual) → Pinecone.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "Question embedding → Pinecone semantic search → top-k chunks → optional query augmentation.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "Contextual prompt → Groq LLM (Llama 3) → concise answer + citations + confidence score.",
              icon: FileSearch,
            },
          ],
          whatItDoes: "Key Features",
          builtFor:
            "Complete RAG system with evaluation dashboard for full transparency.",
          features: [
            {
              label: "Multilingual RAG",
              desc: "Cohere embed-v3 with 100+ language support, routed to BM, EN, or zh outputs.",
              icon: Globe,
            },
            {
              label: "Evaluation Suite",
              desc: "ROUGE, BLEU, Flesch-Kincaid, exact match, and real-time latency metrics.",
              icon: BarChart3,
            },
            {
              label: "Streaming Tests",
              desc: "Run test suites with live results in the /eval dashboard.",
              icon: Shield,
            },
            {
              label: "Query Augmentation",
              desc: "Expand questions across languages for better retrieval coverage.",
              icon: Mic,
            },
          ],
          watchDemo: "Technical Demonstration",
          seeItWork: "System processing real government documents",
          builtWith: "Technology Stack",
          previewQ: "Query: Who is eligible to apply for this benefit?",
          previewA:
            "According to Section 2.1, applicants must be Malaysian citizens aged 18+ with household income ≤RM4,000.",
          previewSrc: "Chunk ID: doc_001_chunk_42 | Similarity: 0.89",
        }

  const comparison =
    language === "ms"
      ? {
          kicker: "Differentiation vs Generic RAG",
          title: "Government documents, explained in your language.",
          subhead:
            'Bukan "GPT + PDF upload". Diposisikan sebagai "Malaysian-first civic AI": bercakap Bahasa Melayu secara semula jadi, faham konteks kerajaan, dan telus melalui sumber + halaman.',
          columns: [
            "Lingua Rakyat",
            "ChatGPT + PDF upload",
            "Generic RAG",
            "Portal Agensi",
            "Google Search",
          ],
          rows: [
            {
              label: "Bahasa Melayu natural",
              values: [true, false, false, true, false],
            },
            {
              label: "Fokus dokumen kerajaan Malaysia",
              values: [true, false, false, true, false],
            },
            {
              label: "Sumber + halaman PDF",
              values: [true, false, true, true, false],
            },
            {
              label: "Badge keyakinan",
              values: [true, true, true, false, false],
            },
            {
              label: "Mod luar talian (cache)",
              values: [true, false, false, false, false],
            },
            {
              label: "Carian semantik multilingual",
              values: [true, false, true, false, false],
            },
            {
              label: "Urus dokumen (upload/rename/delete)",
              values: [true, false, false, true, false],
            },
            {
              label: "Metrik penilaian (ROUGE/BLEU)",
              values: [true, false, false, false, false],
            },
          ],
          footnote:
            "Nota: Mod luar talian bergantung pada dokumen dan petikan yang telah dicache semasa dalam talian.",
        }
      : {
          kicker: "Differentiation vs Generic RAG",
          title: "Government documents, explained in your language.",
          subhead:
            'Not "GPT + PDF upload". Positioned as "Malaysian-first civic AI": speaks Malay naturally, knows government context, and stays transparent with sources + pages.',
          columns: [
            "Lingua Rakyat",
            "ChatGPT + PDF upload",
            "Generic RAG",
            "Agency Portal",
            "Google Search",
          ],
          rows: [
            {
              label: "Natural Malay support",
              values: [true, false, false, true, false],
            },
            {
              label: "Malaysia government-first",
              values: [true, false, false, true, false],
            },
            {
              label: "PDF citations + pages",
              values: [true, false, true, true, false],
            },
            {
              label: "Confidence badge",
              values: [true, true, true, false, false],
            },
            {
              label: "Offline mode (cache)",
              values: [true, false, false, false, false],
            },
            {
              label: "Multilingual semantic retrieval",
              values: [true, false, true, false, false],
            },
            {
              label: "Document management",
              values: [true, false, false, true, false],
            },
            {
              label: "Built-in eval metrics",
              values: [true, false, false, false, false],
            },
          ],
          footnote:
            "Note: Offline mode depends on documents and excerpts cached earlier while online.",
        }

  return (
    <div className="min-h-screen bg-background/50">
      <main className="relative mx-auto max-w-7xl border-x px-4 sm:px-6 lg:px-10">
        <motion.section
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative flex items-center pt-10 pb-12 sm:pt-24 sm:pb-16 lg:pt-20 lg:pb-14"
        >
          <div className="relative z-10 w-full">
            {/* Logo lockup */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-12 flex items-center justify-between gap-3 sm:mb-16 md:justify-end"
            >
              <div className="flex items-center gap-3">
                <Image
                  src={logo}
                  alt="Lingua Rakyat"
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                />
                <span className="font-heading text-xs font-semibold tracking-[0.35em] text-muted-foreground uppercase">
                  Lingua Rakyat
                </span>
              </div>
              <div>
                <ModeToggle />
                <button
                  onClick={toggleLanguage}
                  className="border border-border/50 bg-background/40 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-primary"
                >
                  {language === "ms" ? "EN" : "MS"}
                </button>
              </div>
            </motion.div>

            {/* Split Layout: Visual on top for mobile, right side for desktop */}
            <div className="grid grid-cols-1 items-center gap-8 sm:gap-12 lg:grid-cols-12 lg:gap-16">
              {/* Visual - appears first on mobile, last on desktop */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease }}
                className="relative h-[240px] w-full overflow-hidden sm:h-[280px] lg:order-last lg:h-[400px] xl:h-[500px]"
              >
                <HeroLiquidMetalRoot
                  desktopShaderProps={{
                    scale: 0.9,
                    speed: 0.7,
                    repetition: 7,
                    softness: 0.9,
                    distortion: 0.3,
                    colorTint: isDark ? "#4ade80" : "#1a7a4f",
                  }}
                  image="https://shaders.paper.design/images/logos/diamond.svg"
                >
                  <div className="relative h-full w-full">
                    {/* Desktop visual - hidden on mobile */}
                    <div className="hidden h-full w-full lg:block">
                      <HeroLiquidMetalVisual
                        desktopShaderProps={{
                          scale: 0.9,
                          speed: 0.7,
                          repetition: 7,
                          softness: 0.9,
                          distortion: 0.3,
                          colorTint: isDark ? "#4ade80" : "#1a7a4f",
                        }}
                      />
                    </div>

                    {/* Mobile visual - visible only on mobile, better positioned */}
                    <div className="-mt-8 h-full w-full lg:hidden">
                      <HeroLiquidMetalMobileVisual
                        mobileShaderProps={{
                          scale: 0.75,
                          speed: 0.7,
                          repetition: 6,
                          softness: 0.85,
                          distortion: 0.25,
                          colorTint: isDark ? "#4ade80" : "#1a7a4f",
                        }}
                      />
                    </div>
                  </div>
                </HeroLiquidMetalRoot>
              </motion.div>

              {/* Text Content */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="text-center sm:col-span-7 lg:text-left"
              >
                <motion.div
                  variants={itemVariants}
                  className="mb-6 inline-flex items-center gap-2 border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary backdrop-blur-sm sm:mb-8 sm:px-4 sm:py-2 sm:text-sm lg:inline-flex"
                >
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                  {copy.kicker}
                </motion.div>

                <motion.h1
                  variants={itemVariants}
                  className="mb-6 text-3xl font-bold tracking-tight uppercase sm:mb-8 sm:text-5xl md:text-6xl lg:text-7xl"
                >
                  {copy.headline1}
                  <br />
                  <span className="text-primary">{copy.headline2}</span>
                </motion.h1>

                <motion.p
                  variants={itemVariants}
                  className="mx-auto mb-8 max-w-3xl text-base leading-relaxed text-muted-foreground sm:mb-12 sm:text-lg md:text-xl lg:mx-0"
                >
                  {copy.subhead}
                </motion.p>

                <motion.div
                  variants={itemVariants}
                  className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start"
                >
                  <Link href="/workspace" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="group w-full gap-2 bg-primary px-6 text-sm transition-all hover:bg-primary/90 sm:w-auto sm:px-8 sm:text-base"
                    >
                      {copy.cta}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4" />
                    </Button>
                  </Link>
                  <Button
                    size="lg"
                    variant="outline"
                    className="group w-full gap-2 px-6 text-sm transition-all hover:scale-105 hover:border-primary/30 hover:bg-primary/5 sm:w-auto sm:px-8 sm:text-base"
                    onClick={() =>
                      document
                        .getElementById("demo-section")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                    {copy.ctaSecondary}
                  </Button>
                </motion.div>

                <motion.div
                  animate="animate"
                  className="mt-12 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground sm:mt-20 sm:gap-6 sm:text-sm lg:justify-start lg:gap-8"
                >
                  {copy.strip.map((item, i) => (
                    <div key={i} className="flex items-center gap-1 sm:gap-2">
                      {i > 0 && (
                        <span className="text-muted-foreground/30">&bull;</span>
                      )}
                      <span>{item}</span>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        <FadeInUp>
          <section className="pb-16 sm:pb-24 lg:pb-32">
            <div className="group relative overflow-hidden border border-border bg-card/40 p-4 shadow-sm backdrop-blur-sm transition-all hover:shadow-md sm:p-6 lg:p-8">
              <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="relative">
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground/60 sm:mb-4">
                  <FileText className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                  <span className="font-mono text-[10px] tracking-[0.12em] uppercase sm:text-xs">
                    BANTUAN_RAKYAT_1MALAYSIA_2024.PDF
                  </span>
                </div>

                <div className="space-y-4 font-mono text-xs sm:space-y-5 sm:text-sm">
                  <div>
                    <span className="font-bold text-primary">{">"} </span>
                    <span className="text-foreground">{copy.previewQ}</span>
                  </div>

                  <div className="border-l-2 border-primary/20 pl-3 text-muted-foreground sm:pl-4">
                    <p className="leading-relaxed">{copy.previewA}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/50 sm:mt-3">
                      <BookOpen className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                      <span>&mdash; {copy.previewSrc}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground/30">{">"}</span>
                    <motion.span
                      animate={{ opacity: [1, 1, 0, 0] }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        times: [0, 0.45, 0.5, 1],
                      }}
                      className="ml-1 inline-block h-[1em] w-1.5 bg-primary align-middle sm:w-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </FadeInUp>

        {/* Comparison */}
        <section className="pb-16 sm:pb-24 lg:pb-32">
          <Separator className="h-px" />
          <FadeInLeft>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {comparison.kicker}
            </p>
          </FadeInLeft>

          <FadeInLeft delay={0.05}>
            <h2 className="mt-2 max-w-[32ch] text-2xl font-semibold text-foreground sm:mt-3 sm:text-3xl lg:text-4xl">
              {comparison.title}
            </h2>
          </FadeInLeft>

          <FadeInLeft delay={0.1}>
            <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
              {comparison.subhead}
            </p>
          </FadeInLeft>

          <FadeInUp>
            <div className="mt-8 overflow-x-auto border border-border bg-card/40 backdrop-blur-sm">
              <table className="w-full min-w-[640px] border-collapse text-sm sm:min-w-[860px]">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="w-[320px] border-b border-border px-4 py-3 text-left text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      Feature
                    </th>
                    {comparison.columns.map((col, colIdx) => (
                      <th
                        key={col}
                        className={[
                          "border-b border-border px-4 py-3 text-left text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase",
                          colIdx >= 3 ? "hidden sm:table-cell" : "",
                        ].join(" ")}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparison.rows.map((row) => (
                    <tr key={row.label} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground/80">
                        {row.label}
                      </td>
                      {row.values.map((value: boolean, idx: number) => (
                        <td
                          key={idx}
                          className={[
                            "px-4 py-3",
                            idx >= 3 ? "hidden sm:table-cell" : "",
                          ].join(" ")}
                        >
                          {value ? (
                            <span className="inline-flex items-center text-primary">
                              <Check className="h-4 w-4" />
                              <span className="sr-only">yes</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              &mdash;
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {comparison.footnote}
            </p>
          </FadeInUp>
        </section>

        {/* Rest of your sections remain the same */}
        <section className="pb-16 sm:pb-24 lg:pb-32">
          <Separator className="h-px" />
          <FadeInLeft>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.howItWorks}
            </p>
          </FadeInLeft>

          <div className="mt-8 grid gap-6 sm:mt-12 sm:gap-8 md:grid-cols-3">
            {copy.steps.map((step, i) => (
              <FadeInUp key={step.n} delay={i * 0.1}>
                <div className="group relative min-h-56 border border-border bg-card/40 p-5 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/60 hover:shadow-lg sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-heading text-3xl font-bold text-primary/30 sm:text-4xl">
                      {step.n}
                    </span>
                    <step.icon className="h-6 w-6 text-primary/40 transition-all group-hover:scale-110 group-hover:text-primary sm:h-8 sm:w-8" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground sm:text-xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-3 sm:text-sm">
                    {step.desc}
                  </p>
                </div>
              </FadeInUp>
            ))}
          </div>
        </section>

        <section className="pb-16 sm:pb-24 lg:pb-32">
          <Separator className="h-px" />
          <FadeInLeft>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.whatItDoes}
            </p>
          </FadeInLeft>

          <FadeInLeft delay={0.05}>
            <p className="mt-4 max-w-[42ch] text-xl leading-snug font-semibold text-foreground sm:mt-6 sm:text-2xl md:text-3xl lg:text-4xl">
              {copy.builtFor}
            </p>
          </FadeInLeft>

          {/* Improved mobile grid layout */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {copy.features.map((f, i) => (
              <ScaleIn key={f.label} delay={i * 0.07}>
                {/* Better mobile card design */}
                <div className="group flex flex-col items-center border border-border bg-card/40 p-5 text-center backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/60 hover:shadow-md sm:items-start sm:p-5 sm:text-left">
                  {/* Centered icon on mobile, left-aligned on desktop */}
                  <div className="flex justify-center sm:justify-start">
                    <f.icon className="mb-3 h-8 w-8 text-primary/60 transition-all group-hover:scale-110 group-hover:text-primary sm:mb-3 sm:h-7 sm:w-7" />
                  </div>

                  {/* Centered text on mobile, left-aligned on desktop */}
                  <div className="text-center sm:text-left">
                    <h4 className="text-sm font-semibold tracking-wide text-foreground sm:text-sm">
                      {f.label}
                    </h4>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-2 sm:text-sm">
                      {f.desc}
                    </p>
                  </div>
                </div>
              </ScaleIn>
            ))}
          </div>
        </section>

        {/* Video demo section with responsive media player */}
        <section id="demo-section" className="pb-16 sm:pb-24 lg:pb-32">
          <Separator className="h-px" />
          <FadeInLeft>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.watchDemo}
            </p>
          </FadeInLeft>
          <FadeInLeft delay={0.05}>
            <h2 className="mt-2 text-2xl font-semibold text-foreground sm:mt-3 sm:text-3xl">
              {copy.seeItWork}
            </h2>
          </FadeInLeft>

          <ScaleIn>
            {/* Responsive media player container */}
            <div className="mt-6 overflow-hidden rounded-lg border border-border shadow-lg transition-all hover:shadow-xl sm:mt-8">
              {/* Fixed aspect ratio container */}
              <div
                className="relative w-full"
                style={{ paddingBottom: "56.25%" }}
              >
                {" "}
                {/* 16:9 aspect ratio */}
                <div className="absolute top-0 right-0 bottom-0 left-0">
                  <MediaPlayer>
                    <MediaPlayerVideo className="h-full w-full">
                      <source
                        src="https://stream.mux.com/VZtzUzGRv02OhRnZCxcNg49OilvolTqdnFLEqBsTwaxU/medium.mp4"
                        type="video/mp4"
                      />
                    </MediaPlayerVideo>
                    <MediaPlayerControls className="flex-col items-start gap-2.5">
                      <MediaPlayerControlsOverlay />
                      <MediaPlayerSeek />
                      <div className="flex w-full flex-wrap items-center gap-2 px-2 sm:px-0">
                        <div className="flex flex-1 flex-wrap items-center gap-1 sm:gap-2">
                          <MediaPlayerPlay />
                          <MediaPlayerSeekBackward />
                          <MediaPlayerSeekForward />
                          <MediaPlayerVolume expandable />
                          <MediaPlayerTime />
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <MediaPlayerPlaybackSpeed />
                          <MediaPlayerPiP />
                          <MediaPlayerFullscreen />
                        </div>
                      </div>
                    </MediaPlayerControls>
                  </MediaPlayer>
                </div>
              </div>
            </div>
          </ScaleIn>
        </section>

        {/* Tech stack section with responsive logo carousel */}
        <section className="pb-16 sm:pb-24 lg:pb-32">
          <Separator className="h-px" />
          <FadeInUp>
            <p className="mt-5 text-center text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.builtWith}
            </p>
          </FadeInUp>

          <FadeInUp>
            <div className="mt-6 mb-8 flex flex-wrap justify-center gap-2 sm:mt-8 sm:mb-12 sm:gap-3">
              {[
                { name: "Next.js", url: "https://nextjs.org" },
                { name: "FastAPI", url: "https://fastapi.tiangolo.com" },
                { name: "Pinecone", url: "https://pinecone.io" },
                { name: "Cohere", url: "https://cohere.com" },
                { name: "Groq", url: "https://groq.com" },
                { name: "Supabase", url: "https://supabase.com" },
              ].map((tech) => (
                <LinkPreview key={tech.name} url={tech.url}>
                  <span className="inline-block cursor-pointer border border-border bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm sm:px-5 sm:py-2 sm:text-sm">
                    {tech.name}
                  </span>
                </LinkPreview>
              ))}
            </div>
          </FadeInUp>

          {/* Fixed LogoCarousel with responsive overflow handling */}
          <ScaleIn>
            <div className="mt-6 w-full overflow-x-hidden sm:mt-8">
              <div className="relative w-full">
                {/* Add a gradient fade on edges for mobile if needed */}
                <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent md:hidden" />
                <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l from-background to-transparent md:hidden" />

                <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 flex justify-center overflow-x-auto overflow-y-visible pb-4">
                  <div className="min-w-[300px]">
                    <LogoCarousel columnCount={isMobile ? 3 : 5} />
                  </div>
                </div>
              </div>
            </div>
          </ScaleIn>
        </section>
      </main>

      <Footer />
    </div>
  )
}
