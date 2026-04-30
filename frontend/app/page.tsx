"use client"

import { useEffect, useState } from "react"
import {
  motion,
  useScroll,
  useTransform,
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
  Zap,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  HeroLiquidMetalMobileVisual,
  HeroLiquidMetalRoot,
  HeroLiquidMetalVisual,
} from "@/components/ui/hero-liquid-metal"
import { HyperText } from "@/components/ui/hyper-text"
import { ModeToggle } from "@/components/mode-toggle"
import { Backlight } from "@/components/ui/backlight"
const ease = [0.16, 1, 0.3, 1] as const

function SkeletonCard() {
  return (
    <Card className="w-full border border-border/60 bg-card/40 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="aspect-video w-full" />
      </CardContent>
    </Card>
  )
}

function SkeletonAvatar() {
  return (
    <div className="flex w-fit items-center gap-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="min-h-dvh bg-accent/5">
      <main className="relative mx-auto w-full max-w-[1152px] px-4 sm:px-6 lg:px-10 xl:px-12">
        <section className="relative flex items-center pt-10 pb-12 sm:pt-24 sm:pb-16 lg:pt-20 lg:pb-14">
          <div className="relative z-10 w-full">
            <div className="mb-12 flex items-center justify-between gap-3 sm:mb-16">
              <SkeletonAvatar />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-9 w-14" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-8 lg:flex-row-reverse lg:justify-between lg:gap-12">
              <div className="relative h-[240px] w-full overflow-hidden sm:h-[280px] lg:h-[400px] lg:w-5/12 xl:h-[500px]">
                <Skeleton className="h-full w-full rounded-[2rem]" />
              </div>

              <div className="w-full text-center lg:w-7/12 lg:text-left">
                <Skeleton className="mb-4 inline-flex h-8 w-64 sm:mb-6 lg:mb-8" />
                <Skeleton className="mb-3 h-12 w-full max-w-xl sm:h-14 lg:h-16" />
                <Skeleton className="mb-6 h-12 w-full max-w-md sm:mb-8 sm:h-14 lg:mb-8 lg:h-16" />
                <Skeleton className="mx-auto mb-3 h-4 w-full max-w-2xl lg:mx-0" />
                <Skeleton className="mx-auto mb-6 h-4 w-full max-w-xl sm:mb-8 lg:mx-0" />

                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start">
                  <Skeleton className="h-11 w-full sm:w-56" />
                  <Skeleton className="h-11 w-full sm:w-44" />
                </div>

                <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-border/30 pt-6 sm:mt-10 sm:gap-5 sm:pt-8 lg:mt-12 lg:justify-start lg:gap-6 lg:border-0 lg:pt-0">
                  <Skeleton className="h-7 w-32 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-30 rounded-full" />
                  <Skeleton className="h-7 w-36 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-16 sm:pb-24 lg:pb-32">
          <SkeletonCard />
        </section>
      </main>
      <Footer />
    </div>
  )
}

function FadeInUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const shouldReduce = useReducedMotion()

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: shouldReduce ? 0 : 28,
        filter: shouldReduce ? "blur(0px)" : "blur(12px)",
      }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: false, amount: 0.2, margin: "-40px 0px" }}
      transition={{
        duration: shouldReduce ? 0.01 : 0.7,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
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
  const shouldReduce = useReducedMotion()

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: shouldReduce ? 0 : -24,
        filter: shouldReduce ? "blur(0px)" : "blur(10px)",
      }}
      whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      viewport={{ once: false, amount: 0.2, margin: "-40px 0px" }}
      transition={{
        duration: shouldReduce ? 0.01 : 0.6,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
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
  const shouldReduce = useReducedMotion()

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: shouldReduce ? 1 : 0.92,
        filter: shouldReduce ? "blur(0px)" : "blur(10px)",
      }}
      whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: false, amount: 0.15, margin: "-40px 0px" }}
      transition={{
        duration: shouldReduce ? 0.01 : 0.65,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const { language, toggleLanguage } = useLanguage()
  const { theme } = useTheme()
  const isMobile = useMobile()
  const isDark = theme === "dark"
  const shouldReduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.8])
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.98])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.07,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
    },
  }

  const copy =
    language === "ms"
      ? {
          kicker: "AI Multilingual untuk Dokumen Kerajaan",
          headline1: "Retrieval-Augmented",
          headline2: "Generation",

          subhead:
            "Sistem soal jawab dokumen kerajaan berasaskan AI yang menggunakan Cohere embeddings, pangkalan data vektor Pinecone, dan Groq LLM. Menyokong Bahasa Melayu, English, dan Mandarin.",

          cta: "Terokai Demo Teknikal",
          ctaSecondary: "Tonton Demo",

          strip: [
            { icon: FileSearch, label: "Carian Semantik" },
            { icon: BarChart3, label: "ROUGE-1/2/L" },
            { icon: Zap, label: "Inferens Groq" },
            { icon: Target, label: "Skor Keyakinan" },
          ],

          howItWorks: "Aliran Sistem",

          steps: [
            {
              n: "01",
              title: "Ingestion",
              desc: "PDF → pengekstrakan teks → pembahagian (500 perkataan setiap chunk, overlap 50) → embedding Cohere (multilingual) → Pinecone.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "Embedding soalan → carian semantik di Pinecone → ambil top-k chunks → augmentasi pertanyaan (pilihan).",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "Prompt berasaskan konteks → Groq LLM (Llama 3) → jawapan ringkas + petikan + skor keyakinan.",
              icon: FileSearch,
            },
          ],

          whatItDoes: "Ciri-ciri Utama",

          builtFor:
            "Sistem RAG lengkap dengan papan pemuka penilaian untuk ketelusan dan kebolehpercayaan.",

          features: [
            {
              label: "Multilingual RAG",
              desc: "Cohere embed-v3 dengan sokongan 100+ bahasa, menghasilkan jawapan dalam BM, EN, atau zh.",
              icon: Globe,
            },
            {
              label: "Evaluation Suite",
              desc: "ROUGE, BLEU, Flesch-Kincaid, exact match, serta metrik masa nyata.",
              icon: BarChart3,
            },
            {
              label: "Live Testing",
              desc: "Jalankan ujian dan lihat keputusan secara langsung dalam papan pemuka /eval.",
              icon: Shield,
            },
            {
              label: "Query Augmentation",
              desc: "Mengembangkan soalan ke pelbagai bahasa untuk meningkatkan ketepatan carian.",
              icon: Mic,
            },
          ],

          watchDemo: "Demonstrasi Teknikal",
          seeItWork: "Sistem memproses dokumen kerajaan sebenar",

          builtWith: "Stack Teknologi",

          previewQ: "Soalan: Siapakah yang layak memohon bantuan ini?",
          previewA:
            "Berdasarkan Seksyen 2.1, pemohon mestilah warganegara Malaysia berumur 18 tahun ke atas dengan pendapatan isi rumah ≤ RM4,000.",
          previewSrc: "Chunk ID: doc_001_chunk_42 | Similarity: 0.89",
        }
      : {
          kicker: "Multilingual AI for Government Documents",

          headline1: "Retrieval-Augmented",
          headline2: "Generation",

          subhead:
            "An AI-powered government document Q&A system using Cohere embeddings, Pinecone vector database, and Groq LLM. Supports Malay, English, and Chinese.",

          cta: "Explore Technical Demo",
          ctaSecondary: "Watch Demo",

          strip: [
            { icon: FileSearch, label: "Semantic Search" },
            { icon: BarChart3, label: "ROUGE-1/2/L" },
            { icon: Zap, label: "Groq Inference" },
            { icon: Target, label: "Confidence Scoring" },
          ],

          howItWorks: "System Flow",

          steps: [
            {
              n: "01",
              title: "Ingestion",
              desc: "PDF → text extraction → chunking (500-word window, 50 overlap) → Cohere embeddings (multilingual) → Pinecone.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "Question embedding → semantic search in Pinecone → retrieve top-k chunks → optional query augmentation.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "Context-aware prompt → Groq LLM (Llama 3) → concise answer + citations + confidence score.",
              icon: FileSearch,
            },
          ],

          whatItDoes: "Key Features",

          builtFor:
            "A complete RAG system with an evaluation dashboard for transparency and reliability.",

          features: [
            {
              label: "Multilingual RAG",
              desc: "Cohere embed-v3 with support for 100+ languages, generating outputs in BM, EN, or zh.",
              icon: Globe,
            },
            {
              label: "Evaluation Suite",
              desc: "ROUGE, BLEU, Flesch-Kincaid, exact match, and real-time metrics.",
              icon: BarChart3,
            },
            {
              label: "Live Testing",
              desc: "Run test suites and view results in real time in the /eval dashboard.",
              icon: Shield,
            },
            {
              label: "Query Augmentation",
              desc: "Expands queries across languages to improve retrieval accuracy.",
              icon: Mic,
            },
          ],

          watchDemo: "Technical Demonstration",
          seeItWork: "System processing real government documents",

          builtWith: "Technology Stack",

          previewQ: "Query: Who is eligible to apply for this benefit?",
          previewA:
            "According to Section 2.1, applicants must be Malaysian citizens aged 18 and above with a household income ≤ RM4,000.",
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

  if (isLoading) {
    return <HomeSkeleton />
  }

  return (
    <div className="min-h-dvh bg-accent/5">
      <main className="relative mx-auto w-full max-w-[1152px] px-4 sm:px-6 lg:px-10 xl:px-12">
        <motion.section
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative flex items-center pt-10 pb-12 sm:pt-24 sm:pb-16 lg:pt-20 lg:pb-14"
        >
          <div className="relative z-10 w-full">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mb-12 flex items-center justify-between gap-3 sm:mb-16"
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
              <div className="flex items-center gap-2">
                <ModeToggle />
                <button
                  onClick={toggleLanguage}
                  aria-label={
                    language === "ms"
                      ? "Switch to English"
                      : "Tukar ke Bahasa Melayu"
                  }
                  className="border border-border/50 bg-background/40 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-primary"
                >
                  {language === "ms" ? "EN" : "MS"}
                </button>
              </div>
            </motion.div>

            <div className="flex flex-col items-center gap-8 lg:flex-row-reverse lg:justify-between lg:gap-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, delay: 0.15, ease }}
                className="relative h-[240px] w-full overflow-hidden sm:h-[280px] lg:h-[400px] lg:w-5/12 xl:h-[500px]"
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

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full text-center lg:w-7/12 lg:text-left"
              >
                <motion.div
                  variants={itemVariants}
                  className="relative z-10 mb-4 inline-flex items-center gap-1.5 border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/15 sm:mb-6 sm:gap-2 sm:px-4 sm:py-2 sm:text-xs lg:mb-8"
                >
                  <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-4 lg:w-4" />
                  <span className="tracking-wide">{copy.kicker}</span>
                </motion.div>

                <motion.h1
                  variants={itemVariants}
                  className="relative z-10 mb-4 text-3xl font-black tracking-tight uppercase sm:mb-6 sm:text-4xl md:text-5xl lg:mb-8 lg:text-6xl xl:text-7xl"
                >
                  <HyperText
                    as="div"
                    startOnView={!shouldReduce}
                    animateOnHover={!shouldReduce}
                    duration={shouldReduce ? 1 : 900}
                    delay={shouldReduce ? 0 : 100}
                    className="block py-0 font-heading text-3xl text-foreground sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
                  >
                    {copy.headline1}
                  </HyperText>
                  <HyperText
                    as="div"
                    startOnView={!shouldReduce}
                    animateOnHover={!shouldReduce}
                    duration={shouldReduce ? 1 : 900}
                    delay={shouldReduce ? 0 : 240}
                    className="mt-1 block py-0 font-heading text-3xl text-primary sm:mt-2 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
                  >
                    {copy.headline2}
                  </HyperText>
                </motion.h1>

                <motion.p
                  variants={itemVariants}
                  className="relative z-10 mx-auto mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mb-8 sm:text-base lg:mx-0 lg:text-lg xl:text-xl"
                >
                  {copy.subhead}
                </motion.p>

                <motion.div
                  variants={itemVariants}
                  className="relative z-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start"
                >
                  <motion.div
                    className="w-full sm:w-auto"
                    whileHover={shouldReduce ? {} : { scale: 1.02 }}
                    whileTap={shouldReduce ? {} : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <Link href="/workspace">
                      <Button
                        size="default"
                        className="group w-full gap-2 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md sm:px-6 sm:py-2.5 sm:text-base lg:px-7 lg:py-3"
                      >
                        {copy.cta}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 sm:h-4 sm:w-4" />
                      </Button>
                    </Link>
                  </motion.div>

                  <motion.div
                    className="w-full sm:w-auto"
                    whileHover={shouldReduce ? {} : { scale: 1.02 }}
                    whileTap={shouldReduce ? {} : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <Button
                      size="default"
                      variant="outline"
                      className="group w-full gap-2 border-2 px-5 py-2.5 text-sm font-semibold transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md sm:px-6 sm:py-2.5 sm:text-base lg:px-7 lg:py-3"
                      onClick={() =>
                        document
                          .getElementById("demo-section")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      <Play className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110 sm:h-4 sm:w-4" />
                      {copy.ctaSecondary}
                    </Button>
                  </motion.div>
                </motion.div>

                <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-border/30 pt-6 text-xs text-muted-foreground sm:mt-10 sm:gap-5 sm:pt-8 lg:mt-12 lg:justify-start lg:gap-6 lg:border-0 lg:pt-0 lg:text-sm">
                  {copy.strip.map((item, i) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-1.5 border border-border/40 bg-muted/20 px-2.5 py-1 sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
                    >
                      <item.icon className="h-3 w-3 shrink-0 text-primary/70 sm:h-3.5 sm:w-3.5" />
                      <span className="font-medium">{item.label}</span>
                      {i < copy.strip.length - 1 && (
                        <span className="hidden text-muted-foreground/20 sm:ml-1 sm:inline">
                          •
                        </span>
                      )}
                    </div>
                  ))}
                </div>
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
                  <span className="font-mono text-xs tracking-[0.12em] uppercase">
                    BANTUAN_RAKYAT_1MALAYSIA_2024.PDF
                  </span>
                </div>

                <div className="space-y-4 font-mono text-xs sm:space-y-5 sm:text-sm">
                  <div>
                    <span className="font-bold text-primary">{">"} </span>
                    <span className="text-foreground">{copy.previewQ}</span>
                  </div>

                  <div className="bg-muted/20 px-3 py-2 text-muted-foreground sm:px-4">
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
          <FadeInLeft>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {comparison.kicker}
            </p>
          </FadeInLeft>

          <FadeInLeft delay={0.05}>
            <h2 className="mt-2 max-w-[32ch] font-heading text-2xl font-semibold text-foreground sm:mt-3 sm:text-3xl lg:text-4xl">
              {comparison.title}
            </h2>
          </FadeInLeft>

          <FadeInLeft delay={0.1}>
            <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
              {comparison.subhead}
            </p>
          </FadeInLeft>

          <FadeInUp>
            <div className="mt-8 overflow-x-auto border border-border bg-background/40 backdrop-blur-sm">
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
                          "border-b border-border px-4 py-3 text-left text-xs font-semibold tracking-[0.18em] uppercase",
                          colIdx === 0
                            ? "bg-primary/[0.04] text-primary"
                            : "text-muted-foreground",
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
                            idx === 0 ? "bg-primary/[0.06]" : "",
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

        <section className="pb-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.howItWorks}
            </p>
          </FadeInLeft>

          <div className="mt-8 grid gap-6 sm:mt-12 sm:gap-8 md:grid-cols-3">
            {copy.steps.map((step, i) => (
              <FadeInUp key={step.n} delay={i * 0.1}>
                <motion.div
                  className="group relative min-h-60 overflow-hidden border border-border bg-card/40 p-5 backdrop-blur-sm hover:border-primary/30 hover:bg-card/60 hover:shadow-lg sm:p-6"
                  whileHover={shouldReduce ? {} : { y: -4, scale: 1.012 }}
                  whileTap={shouldReduce ? {} : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                >
                  <span className="pointer-events-none absolute right-3 -bottom-3 font-heading text-8xl leading-none font-black text-primary/[0.06] select-none sm:text-9xl">
                    {step.n}
                  </span>
                  <step.icon className="relative mb-4 h-5 w-5 text-primary/50 transition-all group-hover:scale-110 group-hover:text-primary sm:h-6 sm:w-6" />
                  <h3 className="relative font-heading text-lg font-semibold text-foreground sm:text-xl">
                    {step.title}
                  </h3>
                  <p className="relative mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-3 sm:text-sm">
                    {step.desc}
                  </p>
                </motion.div>
              </FadeInUp>
            ))}
          </div>
        </section>

        <section className="pb-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.whatItDoes}
            </p>
          </FadeInLeft>

          <FadeInLeft delay={0.05}>
            <h2 className="mt-4 max-w-[42ch] font-heading text-xl leading-snug font-semibold text-foreground sm:mt-6 sm:text-2xl md:text-3xl lg:text-4xl">
              {copy.builtFor}
            </h2>
          </FadeInLeft>

          <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
            {copy.features.map((f, i) => (
              <FadeInUp key={f.label} delay={i * 0.07}>
                <div className="group flex h-full flex-col border border-border bg-background/40 p-5 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-md sm:p-6">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/15">
                      <f.icon className="h-4 w-4 text-primary/70 transition-colors group-hover:text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground sm:text-base">
                      {f.label}
                    </h4>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              </FadeInUp>
            ))}
          </div>
        </section>

        {/* Video demo section with responsive media player */}
        <section id="demo-section" className="pb-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.watchDemo}
            </p>
          </FadeInLeft>
          <FadeInLeft delay={0.05}>
            <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:mt-3 sm:text-3xl">
              {copy.seeItWork}
            </h2>
          </FadeInLeft>

          <ScaleIn>
            <div className="mt-6 overflow-hidden border border-border shadow-sm transition-all hover:shadow-md sm:mt-8">
              <div
                className="relative w-full"
                style={{ paddingBottom: "56.25%" }}
              >
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
          <FadeInLeft>
            <p className="mt-5 text-center text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.builtWith}
            </p>
          </FadeInLeft>
          <FadeInLeft delay={0.05}>
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
          </FadeInLeft>

          <ScaleIn>
            <div className="mt-6 w-full overflow-x-hidden sm:mt-8">
              <div className="relative w-full">
                <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-linear-to-r from-background to-transparent md:hidden" />
                <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-linear-to-l from-background to-transparent md:hidden" />

                <Backlight blur={6}>
                  <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 flex justify-center overflow-x-auto overflow-y-visible pb-4">
                    <div className="min-w-[300px]">
                      <LogoCarousel columnCount={isMobile ? 3 : 4} />
                    </div>
                  </div>
                </Backlight>
              </div>
            </div>
          </ScaleIn>
        </section>
      </main>
      <Footer />
    </div>
  )
}
