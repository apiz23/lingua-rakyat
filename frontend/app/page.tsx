"use client"

import {
  motion,
  useScroll,
  useTransform,
  useInView,
  type Variants,
} from "framer-motion"
import {
  ArrowRight,
  BookOpen,
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
  HeroLiquidMetalRoot,
  HeroLiquidMetalVisual,
} from "@/components/ui/hero-liquid-metal"

const ease = [0.16, 1, 0.3, 1] as const

function AnimatedRule({ delay = 0 }: { delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <motion.div
      ref={ref}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: isInView ? 1 : 0 }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: "left" }}
      className="h-px w-full bg-linear-to-r from-primary/50 via-border to-transparent"
    />
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
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
      transition={{ duration: 0.6, delay, ease }}
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
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.9 }}
      transition={{ duration: 0.5, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  const { language, toggleLanguage } = useLanguage()
  const { theme } = useTheme()
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
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  }

  const copy =
    language === "ms"
      ? {
          kicker: "Teknologi Digital untuk MADANI",
          headline1: "Dokumen kerajaan",
          headline2: "difahami.",
          subhead:
            "Muat naik PDF rasmi dan tanya soalan dalam Bahasa Melayu, English, atau Mandarin. Jawapan ringkas, bersumber terus dari dokumen.",
          cta: "Cuba Demo",
          ctaSecondary: "Tonton Demo",
          strip: [
            "Melayu · English · 中文",
            "Jawapan bersumber",
            "Metrik ROUGE + BLEU",
          ],
          howItWorks: "Cara penggunaan",
          steps: [
            {
              n: "01",
              title: "Muat Naik",
              desc: "Seret PDF kerajaan anda. Sistem mengekstrak, memecah, dan mengindeks kandungan secara automatik.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Tanya",
              desc: "Taip soalan dalam bahasa pilihan anda — Melayu, English, atau Mandarin.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Jawapan",
              desc: "Terima jawapan ringkas berserta petikan sumber tepat dari dokumen.",
              icon: FileSearch,
            },
          ],
          whatItDoes: "Apa yang dilakukan",
          builtFor: "Dibina untuk rakyat, bukan untuk teknologi semata-mata.",
          features: [
            {
              label: "Pelbagai Bahasa",
              desc: "Soal dalam Melayu, English, atau Mandarin. Jawapan datang dalam bahasa yang sama.",
              icon: Globe,
            },
            {
              label: "Bersumber",
              desc: "Setiap jawapan memetik petikan tepat dari dokumen. Tiada tekaan.",
              icon: Shield,
            },
            {
              label: "Metrik Penilaian",
              desc: "Skor ROUGE, BLEU, dan kebolehbacaan dibina terus dalam sistem.",
              icon: BarChart3,
            },
            {
              label: "Input Suara",
              desc: "Cakap soalan anda — tiada perlu menaip.",
              icon: Mic,
            },
          ],
          watchDemo: "Tonton Demo",
          seeItWork: "Lihat ia berfungsi",
          builtWith: "Dibina dengan",
          previewQ: "Siapa yang layak memohon bantuan ini?",
          previewA:
            "Pemohon mestilah warganegara Malaysia berumur 18 tahun ke atas, berpendapatan isi rumah tidak melebihi RM4,000 sebulan.",
          previewSrc: "Halaman 3, Seksyen 2.1",
        }
      : {
          kicker: "Digital Technology for MADANI Malaysia",
          headline1: "Government documents",
          headline2: "understood.",
          subhead:
            "Upload any official Malaysian PDF and ask questions in Malay, English, or Chinese. Plain answers, cited directly from the source.",
          cta: "Try the Demo",
          ctaSecondary: "Watch Demo",
          strip: [
            "Malay · English · Chinese",
            "Source-grounded answers",
            "ROUGE + BLEU metrics",
          ],
          howItWorks: "How it works",
          steps: [
            {
              n: "01",
              title: "Upload",
              desc: "Drop any government PDF. The system extracts text, chunks it, and indexes it for retrieval.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Ask",
              desc: "Type your question in any supported language — Malay, English, or Chinese.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Answer",
              desc: "Get a concise, cited answer drawn directly from the document.",
              icon: FileSearch,
            },
          ],
          whatItDoes: "What it does",
          builtFor: "Built for citizens, not just for technology's sake.",
          features: [
            {
              label: "Multilingual",
              desc: "Ask in Malay, English, or Chinese. The answer comes back in the same language.",
              icon: Globe,
            },
            {
              label: "Source-grounded",
              desc: "Every answer cites the exact passage it came from. No hallucinations.",
              icon: Shield,
            },
            {
              label: "Evaluation metrics",
              desc: "ROUGE, BLEU, and readability scores are built into the system.",
              icon: BarChart3,
            },
            {
              label: "Voice input",
              desc: "Speak your question in Malay or English — no typing required.",
              icon: Mic,
            },
          ],
          watchDemo: "Watch Demo",
          seeItWork: "See it in action",
          builtWith: "Built with",
          previewQ: "Who is eligible to apply for this benefit?",
          previewA:
            "Applicants must be Malaysian citizens aged 18 and above, with a household income not exceeding RM4,000 per month.",
          previewSrc: "Page 3, Section 2.1",
        }

  return (
    <div className="min-h-screen bg-background/50">
      <main className="relative mx-auto max-w-7xl border-x px-6 lg:px-10">
        <motion.section
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative flex items-center pt-16 pb-10 lg:pt-20 lg:pb-14"
        >
          <div className="relative z-10 w-full">
            {/* Logo lockup */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-16 flex items-center justify-center gap-3 md:justify-end"
            >
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
              <button
                onClick={toggleLanguage}
                className="border border-border/50 bg-background/40 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-primary"
              >
                {language === "ms" ? "EN" : "MS"}
              </button>
            </motion.div>

            {/* Split Layout: Left Content + Right Visual */}
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Left Side - Text Content */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="text-center lg:text-left"
              >
                <motion.div
                  variants={itemVariants}
                  className="mb-8 inline-flex items-center gap-2 border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm lg:inline-flex"
                >
                  <Sparkles className="h-4 w-4" />
                  {copy.kicker}
                </motion.div>

                <motion.h1
                  variants={itemVariants}
                  className="mb-8 text-5xl font-bold tracking-tight uppercase sm:text-6xl md:text-7xl lg:text-7xl"
                >
                  {copy.headline1}
                  <br />
                  <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {copy.headline2}
                  </span>
                </motion.h1>

                <motion.p
                  variants={itemVariants}
                  className="mx-auto mb-12 max-w-3xl text-lg leading-relaxed text-muted-foreground sm:text-xl lg:mx-0"
                >
                  {copy.subhead}
                </motion.p>

                <motion.div
                  variants={itemVariants}
                  className="flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start"
                >
                  <Link href="/workspace">
                    <Button
                      size="lg"
                      className="group gap-2 bg-primary px-8 text-base shadow-lg transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-xl"
                    >
                      {copy.cta}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                  <Button
                    size="lg"
                    variant="outline"
                    className="group gap-2 px-8 text-base transition-all hover:scale-105 hover:border-primary/30 hover:bg-primary/5"
                    onClick={() =>
                      document
                        .getElementById("demo-section")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    <Play className="h-4 w-4" />
                    {copy.ctaSecondary}
                  </Button>
                </motion.div>

                <motion.div
                  animate="animate"
                  className="mt-20 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground lg:justify-start"
                >
                  {copy.strip.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i > 0 && (
                        <span className="text-muted-foreground/30">•</span>
                      )}
                      <span>{item}</span>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              {/* Right Side - Heatmap Visual (no text, pure visual) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease }}
                className="relative h-[500px] w-full overflow-hidden"
              >
                <HeroLiquidMetalRoot
                  desktopShaderProps={{
                    scale: 0.8,
                    speed: 0.7,
                    repetition: 7,
                    softness: 0.9,
                    distortion: 0.3,
                    colorTint: isDark ? "#4ade80" : "#1a7a4f",
                  }}
                  image="https://shaders.paper.design/images/logos/diamond.svg"
                >
                  <div className="h-full w-full">
                    <HeroLiquidMetalVisual
                      desktopShaderProps={{
                        scale: 0.8,
                        speed: 0.7,
                        repetition: 7,
                        softness: 0.9,
                        distortion: 0.3,
                        colorTint: isDark ? "#4ade80" : "#1a7a4f",
                      }}
                    />
                  </div>
                </HeroLiquidMetalRoot>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ── Terminal preview ─────────────────────────────────── */}
        <FadeInUp>
          <section className="pb-24 lg:pb-32">
            <div className="group relative overflow-hidden border border-border bg-card/40 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md lg:p-8">
              <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="relative">
                <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground/60">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono tracking-[0.12em] uppercase">
                    BANTUAN_RAKYAT_1MALAYSIA_2024.PDF
                  </span>
                </div>

                <div className="space-y-5 font-mono text-sm">
                  <div>
                    <span className="font-bold text-primary">{">"} </span>
                    <span className="text-foreground">{copy.previewQ}</span>
                  </div>

                  <div className="border-l-2 border-primary/20 pl-4 text-muted-foreground">
                    <p className="leading-relaxed">{copy.previewA}</p>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/50">
                      <BookOpen className="h-3 w-3 shrink-0" />
                      <span>— {copy.previewSrc}</span>
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
                      className="ml-1 inline-block h-[1em] w-2 bg-primary align-middle"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </FadeInUp>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="pb-24 lg:pb-32">
          <AnimatedRule />
          <FadeInUp>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.howItWorks}
            </p>
          </FadeInUp>

          <div className="mt-12 grid gap-8 md:grid-cols-3 ">
            {copy.steps.map((step, i) => (
              <FadeInUp key={step.n} delay={i * 0.1}>
                <div className="min-h-56 group relative border border-border bg-card/40 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/60 hover:shadow-lg">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-heading text-4xl font-bold text-primary/30">
                      {step.n}
                    </span>
                    <step.icon className="h-8 w-8 text-primary/40 transition-all group-hover:scale-110 group-hover:text-primary" />
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </FadeInUp>
            ))}
          </div>
        </section>

        {/* ── What it does ─────────────────────────────────────── */}
        <section className="pb-24 lg:pb-32">
          <AnimatedRule />
          <FadeInUp>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.whatItDoes}
            </p>
          </FadeInUp>

          <FadeInUp>
            <p className="mt-6 max-w-[42ch] font-heading text-3xl leading-snug font-semibold text-foreground lg:text-4xl">
              {copy.builtFor}
            </p>
          </FadeInUp>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {copy.features.map((f, i) => (
              <ScaleIn key={f.label} delay={i * 0.07}>
                <div className="group border border-border bg-card/40 p-5 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/60 hover:shadow-md">
                  <f.icon className="mb-3 h-8 w-8 text-primary/60 transition-all group-hover:scale-110 group-hover:text-primary" />
                  <h4 className="text-sm font-semibold tracking-wide text-foreground">
                    {f.label}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              </ScaleIn>
            ))}
          </div>
        </section>

        {/* ── Video demo ───────────────────────────────────────── */}
        <section id="demo-section" className="pb-24 lg:pb-32">
          <AnimatedRule />
          <FadeInUp>
            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.watchDemo}
            </p>
          </FadeInUp>
          <FadeInUp>
            <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground">
              {copy.seeItWork}
            </h2>
          </FadeInUp>

          <ScaleIn>
            <div className="mt-8 overflow-hidden border border-border shadow-lg transition-all hover:shadow-xl">
              <MediaPlayer>
                <MediaPlayerVideo className="aspect-video">
                  <source
                    src="https://stream.mux.com/VZtzUzGRv02OhRnZCxcNg49OilvolTqdnFLEqBsTwaxU/medium.mp4"
                    type="video/mp4"
                  />
                </MediaPlayerVideo>
                <MediaPlayerControls className="flex-col items-start gap-2.5">
                  <MediaPlayerControlsOverlay />
                  <MediaPlayerSeek />
                  <div className="flex w-full items-center gap-2">
                    <div className="flex flex-1 items-center gap-2">
                      <MediaPlayerPlay />
                      <MediaPlayerSeekBackward />
                      <MediaPlayerSeekForward />
                      <MediaPlayerVolume expandable />
                      <MediaPlayerTime />
                    </div>
                    <div className="flex items-center gap-2">
                      <MediaPlayerPlaybackSpeed />
                      <MediaPlayerPiP />
                      <MediaPlayerFullscreen />
                    </div>
                  </div>
                </MediaPlayerControls>
              </MediaPlayer>
            </div>
          </ScaleIn>
        </section>

        {/* ── Tech stack ───────────────────────────────────────── */}
        <section className="pb-24 lg:pb-32">
          <AnimatedRule />
          <FadeInUp>
            <p className="mt-5 text-center text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {copy.builtWith}
            </p>
          </FadeInUp>

          <FadeInUp>
            <div className="mt-8 mb-12 flex flex-wrap justify-center gap-3">
              {[
                { name: "Next.js", url: "https://nextjs.org" },
                { name: "FastAPI", url: "https://fastapi.tiangolo.com" },
                { name: "Pinecone", url: "https://pinecone.io" },
                { name: "Cohere", url: "https://cohere.com" },
                { name: "Groq", url: "https://groq.com" },
                { name: "Supabase", url: "https://supabase.com" },
              ].map((tech) => (
                <LinkPreview key={tech.name} url={tech.url}>
                  <span className="inline-block cursor-pointer border border-border bg-background/40 px-5 py-2 text-sm font-medium text-foreground backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm">
                    {tech.name}
                  </span>
                </LinkPreview>
              ))}
            </div>
          </FadeInUp>

          <ScaleIn>
            <div className="mt-8">
              <div className="flex justify-center">
                <LogoCarousel columnCount={5} />
              </div>
            </div>
          </ScaleIn>
        </section>
      </main>

      <Footer />
    </div>
  )
}
