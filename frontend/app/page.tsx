"use client"

import dynamic from "next/dynamic"
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

import Link from "next/link"
import Image from "next/image"
import Footer from "@/components/footer"
import { useLanguage } from "@/components/language-provider"
import logo from "@/public/icons/android-chrome-512x512.png"
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/components/ui/scroll-based-velocity"
import {
  Terminal,
  AnimatedSpan,
  TypingAnimation,
} from "@/components/ui/terminal"

const DemoVideo = dynamic(
  () => import("@/components/demo-video").then((m) => m.DemoVideo),
  { ssr: false }
)
const TechStackLogos = dynamic(
  () => import("@/components/tech-stack-logos").then((m) => m.TechStackLogos),
  { ssr: false }
)
import bgNew from "@/public/assets/background-new3.webp"
import mykadImg from "@/public/assets/MyKad.webp"
import passportImg from "@/public/assets/passport.webp"
import personImg from "@/public/assets/person.webp"

const ease = [0.16, 1, 0.3, 1] as const

const DEMO_VIDEO_SRC =
  "https://otmlfmgyscrohtbpqqoi.supabase.co/storage/v1/object/public/videos/lv_0_20260609134554.mp4"

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
  const { language, toggleLanguage } = useLanguage()
  const shouldReduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.8])
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.98])
  const surfaceClass = "neo-card bg-card"
  const mutedTextClass = "text-muted-foreground"
  const faintTextClass = "text-muted-foreground"

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
          headline1: "Dokumen kerajaan, diterangkan dalam",
          headline2: "bahasa anda.",

          subhead:
            "Sistem soal jawab dokumen kerajaan berasaskan AI yang menggunakan Cohere multilingual embeddings, penyusunan semula neural Cohere, dan Groq LLaMA 3.3 70B. Jawapan bersumberkan dokumen dengan skor ketepatan, dalam Bahasa Melayu, English, dan Mandarin.",

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
              desc: "PDF → pengekstrakan teks → pembahagian bahagian-sedar (360 patah perkataan, overlap 45) → embedding Cohere multilingual-v3 → Pinecone.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "Pengesanan bahasa → augmentasi pertanyaan (×4 varian) → embedding Cohere → carian vektor Pinecone → penyusunan semula neural Cohere → top-k chunks.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "Pengawal bukti → prompt berasaskan konteks → Groq LLaMA 3.3 70B → jawapan beranak + petikan sumber + skor keyakinan + skor ketepatan.",
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
              label: "Suara I/O",
              desc: "Tanya melalui suara (Groq Whisper STT) dan dengar jawapan dibaca balik (ElevenLabs TTS). Sokongan speechSynthesis pelayar sebagai sandaran.",
              icon: Mic,
            },
            {
              label: "Pengawal Bukti",
              desc: "Menolak berhalusinasi — hanya menjawab apabila bukti kukuh. Setiap jawapan disertai skor ketepatan (faithfulness) terhadap sumber.",
              icon: Shield,
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

          headline1: "Government documents, explained in",
          headline2: "your language.",

          subhead:
            "An AI-powered government document Q&A system using Cohere multilingual embeddings, Cohere neural reranking, and Groq LLaMA 3.3 70B. Source-cited answers with faithfulness scoring in Malay, English, and Chinese.",

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
              desc: "PDF → text extraction → section-aware chunking (360-word window, 45-word overlap) → Cohere embed-multilingual-v3 → Pinecone.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "Language detection → multi-query augmentation (×4 variants) → Cohere embedding → Pinecone vector search → Cohere neural reranking → top-k chunks.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "Evidence guard → context-aware prompt → Groq LLaMA 3.3 70B → streamed answer + source citations + confidence + faithfulness score.",
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
              label: "Voice I/O",
              desc: "Ask by voice (Groq Whisper STT) and hear answers read back (ElevenLabs TTS). Browser speechSynthesis fallback when offline.",
              icon: Mic,
            },
            {
              label: "Evidence Guard",
              desc: "Refuses to hallucinate — only answers when retrieved evidence clears the confidence threshold. Every answer carries a faithfulness score.",
              icon: Shield,
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
          title: "Dibina untuk AI sivik Malaysia, bukan chatbot generik.",
          subhead:
            'Bukan "GPT + PDF upload". Diposisikan sebagai "Malaysian-first civic AI": bercakap Bahasa Melayu secara semula jadi, faham konteks kerajaan, dan telus melalui sumber + halaman.',
          columns: [
            "Lingua Rakyat",
            "ChatGPT + PDF upload",
            "NotebookLM",
            "Claude Projects",
          ],
          rows: [
            {
              label: "Bahasa Melayu natural",
              values: [true, true, true, true],
            },
            {
              label: "Fokus dokumen kerajaan Malaysia",
              values: [true, false, false, false],
            },
            {
              label: "Sumber + halaman PDF",
              values: [true, true, true, true],
            },
            {
              label: "Badge keyakinan",
              values: [true, false, false, false],
            },
            {
              label: "Mod luar talian (cache)",
              values: [true, false, false, false],
            },
            {
              label: "Carian semantik multilingual",
              values: [true, true, true, true],
            },
            {
              label: "Urus dokumen (upload/rename/delete)",
              values: [true, false, true, true],
            },
            {
              label: "Metrik penilaian (ROUGE/BLEU)",
              values: [true, false, false, false],
            },
            {
              label: "Skor ketepatan sumber (faithfulness)",
              values: [true, false, false, false],
            },
            {
              label: "Suara I/O (STT + TTS)",
              values: [true, true, true, false],
            },
          ],
          footnote:
            "Nota: Mod luar talian bergantung pada dokumen dan petikan yang telah dicache semasa dalam talian.",
        }
      : {
          kicker: "Differentiation vs Generic RAG",
          title: "Built for Malaysian civic AI, not generic chatbots.",
          subhead:
            'Not "GPT + PDF upload". Positioned as "Malaysian-first civic AI": speaks Malay naturally, knows government context, and stays transparent with sources + pages.',
          columns: [
            "Lingua Rakyat",
            "ChatGPT + PDF upload",
            "NotebookLM",
            "Claude Projects",
          ],
          rows: [
            {
              label: "Natural Malay support",
              values: [true, true, true, true],
            },
            {
              label: "Malaysia government-first",
              values: [true, false, false, false],
            },
            {
              label: "PDF citations + pages",
              values: [true, true, true, true],
            },
            {
              label: "Confidence badge",
              values: [true, false, false, false],
            },
            {
              label: "Offline mode (cache)",
              values: [true, false, false, false],
            },
            {
              label: "Multilingual semantic retrieval",
              values: [true, true, true, true],
            },
            {
              label: "Document management",
              values: [true, false, true, true],
            },
            {
              label: "Built-in eval metrics (ROUGE/BLEU)",
              values: [true, false, false, false],
            },
            {
              label: "Faithfulness scoring (answer vs sources)",
              values: [true, false, false, false],
            },
            {
              label: "Voice I/O (STT + TTS)",
              values: [true, true, true, false],
            },
          ],
          footnote:
            "Note: Offline mode depends on documents and excerpts cached earlier while online.",
        }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background">
      {/* Background Image */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${bgNew.src})`,
        }}
      />

      {/* Overlay for text readability */}
      <div className="absolute inset-0 z-1 bg-background/45 dark:bg-background/75" />

      <main className="relative z-10 mx-auto w-full max-w-full px-5 sm:px-8 lg:max-w-[70%] lg:px-10 xl:px-14">
        <motion.section
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative flex items-center pt-10 pb-12 sm:pt-8 sm:pb-16 lg:pt-6 lg:pb-14"
        >
          <div className="relative z-10 w-full">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mb-12 flex items-center justify-between gap-3 sm:mb-10"
            >
              <div className="flex items-center gap-3">
                <Image
                  src={logo}
                  alt="Lingua Rakyat"
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                />
                <span className="font-heading text-xs font-semibold tracking-[0.35em] text-foreground uppercase">
                  Lingua Rakyat
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleLanguage}
                  aria-label={
                    language === "ms"
                      ? "Switch to English"
                      : "Tukar ke Bahasa Melayu"
                  }
                  className="neo-btn bg-background px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-foreground uppercase hover:text-primary"
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
                className="relative h-[280px] w-full overflow-visible sm:h-[360px] lg:h-[440px] lg:w-5/12 xl:h-[520px]"
              >
                <div
                  className={`relative h-full overflow-hidden ${surfaceClass}`}
                >
                  <div className="absolute top-4 left-4 z-20 max-w-[42%] border-2 border-foreground bg-background/95 px-3 py-2 text-left shadow-[4px_4px_0_0_hsl(var(--shadow-color)/0.85)] sm:top-6 sm:left-6 sm:px-4">
                    <p className="text-[10px] font-semibold tracking-[0.22em] text-primary uppercase">
                      {language === "ms" ? "Panduan" : "Guidance"}
                    </p>
                    <p
                      className={`mt-1 text-xs leading-relaxed sm:text-sm ${mutedTextClass}`}
                    >
                      {language === "ms"
                        ? "Baca dokumen rasmi dalam bahasa yang lebih jelas."
                        : "Read official documents in language that feels clearer."}
                    </p>
                  </div>
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: shouldReduce ? 0 : -14,
                      rotate: -6,
                    }}
                    animate={{ opacity: 1, y: 0, rotate: -6 }}
                    transition={{ duration: 0.5, delay: 0.7, ease }}
                    className="absolute top-[44%] left-[5%] z-20 w-[108px] sm:w-[132px] lg:w-[150px]"
                  >
                    <Image
                      src={mykadImg}
                      alt="Malaysian MyKad identity card"
                      width={150}
                      height={96}
                      className="h-auto w-full object-contain"
                    />
                  </motion.div>
                  <motion.div
                    initial={{
                      opacity: 0,
                      x: shouldReduce ? 0 : 14,
                      rotate: 8,
                    }}
                    animate={{ opacity: 1, x: 0, rotate: 8 }}
                    transition={{ duration: 0.5, delay: 0.92, ease }}
                    className="absolute right-[4%] bottom-[10%] z-20 w-[84px] sm:w-[102px] lg:w-[112px]"
                  >
                    <Image
                      src={passportImg}
                      alt="Malaysian passport"
                      width={112}
                      height={148}
                      className="h-auto w-full object-contain"
                    />
                  </motion.div>
                  <div className="absolute right-[4%] bottom-0 z-10 h-[96%] w-[78%] sm:right-[6%] sm:w-[72%] lg:w-[80%]">
                    <Image
                      src={personImg}
                      alt="Malaysian civic guide helping users understand official documents"
                      fill
                      priority
                      className="object-contain object-bottom"
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full text-center lg:w-7/12 lg:text-left"
              >
                <motion.div
                  variants={itemVariants}
                  className="neo-btn relative z-10 mb-4 inline-flex items-center gap-1.5 bg-background px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground sm:mb-6 sm:gap-2 sm:px-4 sm:py-2 sm:text-xs lg:mb-8"
                >
                  <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-4 lg:w-4" />
                  <span className="tracking-wide">{copy.kicker}</span>
                </motion.div>

                <motion.h1
                  initial={{
                    opacity: 0,
                    y: shouldReduce ? 0 : 20,
                    filter: shouldReduce ? "blur(0px)" : "blur(8px)",
                  }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: false, amount: 0.1 }}
                  transition={{
                    duration: shouldReduce ? 0.01 : 0.6,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className="relative z-10 mb-4 text-3xl font-black tracking-tight uppercase sm:mb-6 sm:text-4xl md:text-5xl lg:mb-8 lg:text-6xl xl:text-7xl"
                >
                  <span className="block py-0 font-heading text-[1.65rem] leading-tight text-foreground uppercase sm:text-4xl md:text-5xl lg:text-6xl xl:text-5xl">
                    {copy.headline1}
                  </span>
                  <span className="mt-1 block py-0 font-heading text-[1.65rem] leading-tight text-primary uppercase sm:mt-2 sm:text-4xl md:text-5xl lg:text-6xl xl:text-5xl">
                    {copy.headline2}
                  </span>
                </motion.h1>

                <motion.p
                  variants={itemVariants}
                  className={`relative z-10 mx-auto mb-6 max-w-2xl text-sm leading-relaxed sm:mb-8 sm:text-base lg:mx-0 lg:text-lg xl:text-xl ${mutedTextClass}`}
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
                        className="group w-full gap-2 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 sm:px-6 sm:py-2.5 sm:text-base lg:px-7 lg:py-3"
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
                      className="group w-full gap-2 px-5 py-2.5 text-sm font-semibold hover:bg-primary/5 sm:px-6 sm:py-2.5 sm:text-base lg:px-7 lg:py-3"
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

                <div
                  className={`relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3 pt-2 text-xs sm:mt-10 sm:gap-4 lg:mt-12 lg:justify-start lg:gap-4 lg:text-sm ${mutedTextClass}`}
                >
                  {copy.strip.map((item, i) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-1.5 border-2 border-foreground bg-card px-2.5 py-1 shadow-[2px_2px_0_0_hsl(var(--shadow-color)/0.6)]"
                    >
                      <item.icon className="h-3 w-3 shrink-0 text-primary/70 sm:h-3.5 sm:w-3.5" />
                      <span className="font-semibold">{item.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        <div className="relative left-1/2 mb-14 w-screen -translate-x-1/2 border-y-4 border-foreground bg-primary py-4 text-primary-foreground sm:mb-20">
          <ScrollVelocityContainer className="text-3xl font-bold tracking-tight uppercase sm:text-4xl lg:text-5xl">
            <ScrollVelocityRow baseVelocity={3} direction={1}>
              <span className="mx-6">Bahasa Melayu • English • 中文 •</span>
            </ScrollVelocityRow>
            <ScrollVelocityRow baseVelocity={3} direction={-1}>
              <span className="mx-6">Multilingual RAG • Civic AI •</span>
            </ScrollVelocityRow>
          </ScrollVelocityContainer>
        </div>

        <FadeInUp>
          <section className="pb-16 sm:pb-24 lg:pb-32">
            <Terminal className="max-h-none max-w-none border-2 border-foreground bg-black text-zinc-100 shadow-[8px_8px_0_0_hsl(var(--shadow-color)/0.85)]">
              <AnimatedSpan className="flex items-center gap-2 text-xs text-zinc-400 sm:text-sm">
                <FileText className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                <span className="font-mono text-xs tracking-[0.12em] uppercase sm:text-sm">
                  BANTUAN_RAKYAT_1MALAYSIA_2024.PDF
                </span>
              </AnimatedSpan>

              <div className="font-mono text-xs sm:text-sm">
                <span className="font-bold text-zinc-300">{">"} </span>
                <TypingAnimation className="text-zinc-100">
                  {copy.previewQ}
                </TypingAnimation>
              </div>

              <AnimatedSpan className="bg-zinc-900 px-3 py-2 text-zinc-100 sm:px-4 sm:py-3">
                <p className="font-mono text-xs leading-relaxed sm:text-sm">
                  {copy.previewA}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400 sm:mt-3">
                  <BookOpen className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                  <span>&mdash; {copy.previewSrc}</span>
                </div>
              </AnimatedSpan>

              <AnimatedSpan className="flex items-center gap-1 font-mono text-xs sm:text-sm">
                <span className="font-bold text-zinc-300">{">"}</span>
                <motion.span
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    times: [0, 0.45, 0.5, 1],
                  }}
                  className="ml-1 inline-block h-[1em] w-1.5 bg-zinc-300 align-middle sm:w-2"
                />
              </AnimatedSpan>
            </Terminal>
          </section>
        </FadeInUp>

        {/* Comparison */}
        <section className="border-t-4 border-foreground pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">01</span>
              {comparison.kicker}
            </p>
          </FadeInLeft>

          <FadeInLeft delay={0.05}>
            <h2 className="mt-4 max-w-[32ch] font-heading text-2xl font-black tracking-tight text-foreground uppercase sm:mt-5 sm:text-3xl lg:text-4xl">
              {comparison.title}
            </h2>
          </FadeInLeft>

          <FadeInLeft delay={0.1}>
            <p
              className={`mt-4 max-w-[72ch] text-sm leading-relaxed sm:text-base ${mutedTextClass}`}
            >
              {comparison.subhead}
            </p>
          </FadeInLeft>

          <FadeInUp>
            <div className="mt-8 max-h-[360px] overflow-auto border-2 border-foreground bg-card shadow-[6px_6px_0_0_hsl(var(--shadow-color)/0.85)] sm:max-h-none">
              <table className="w-full border-collapse text-sm sm:min-w-[860px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="border-b-2 border-foreground/30 px-3 py-3 text-left text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase sm:w-[320px] sm:px-4">
                      Feature
                    </th>
                    {comparison.columns.map((col, colIdx) => (
                      <th
                        key={col}
                        className={[
                          "border-b-2 border-foreground/30 px-3 py-3 text-left text-xs font-semibold tracking-[0.18em] uppercase sm:px-4",
                          colIdx === 0
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground",
                          colIdx >= 2 ? "hidden sm:table-cell" : "",
                        ].join(" ")}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-foreground/15">
                  {comparison.rows.map((row) => (
                    <tr key={row.label} className="hover:bg-muted/30">
                      <td className="px-3 py-3 font-medium text-foreground/80 sm:px-4">
                        {row.label}
                      </td>
                      {row.values.map((value: boolean, idx: number) => (
                        <td
                          key={idx}
                          className={[
                            "px-3 py-3 sm:px-4",
                            idx === 0 ? "bg-secondary/50" : "",
                            idx >= 2 ? "hidden sm:table-cell" : "",
                          ].join(" ")}
                        >
                          {value ? (
                            <span className="inline-flex items-center font-bold text-primary">
                              <Check className="h-4 w-4" />
                              <span className="sr-only">yes</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">
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
            <p className={`mt-3 text-xs ${mutedTextClass}`}>
              {comparison.footnote}
            </p>
          </FadeInUp>
        </section>

        <section className="border-t-4 border-foreground pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">02</span>
              {copy.howItWorks}
            </p>
          </FadeInLeft>

          <div className="mt-8 grid gap-6 sm:mt-12 sm:gap-8 md:grid-cols-3">
            {copy.steps.map((step, i) => (
              <FadeInUp key={step.n} delay={i * 0.1}>
                <motion.div
                  className={`group relative min-h-60 overflow-hidden border-2 border-foreground bg-card p-5 shadow-[6px_6px_0_0_hsl(var(--shadow-color)/0.85)] transition-all sm:p-6`}
                  whileHover={shouldReduce ? {} : { y: -4, scale: 1.012 }}
                  whileTap={shouldReduce ? {} : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                >
                  <span className="absolute top-3 right-3 border-2 border-foreground bg-primary px-2 py-0.5 font-heading text-sm leading-none font-black text-primary-foreground shadow-[2px_2px_0_0_hsl(var(--shadow-color)/0.85)] select-none">
                    {step.n}
                  </span>
                  <step.icon className="relative mb-4 h-5 w-5 text-primary/70 transition-all group-hover:scale-110 group-hover:text-primary sm:h-6 sm:w-6" />
                  <h3 className="relative font-heading text-lg font-semibold text-foreground sm:text-xl">
                    {step.title}
                  </h3>
                  <p
                    className={`relative mt-2 text-xs leading-relaxed sm:mt-3 sm:text-sm ${mutedTextClass}`}
                  >
                    {step.desc}
                  </p>
                </motion.div>
              </FadeInUp>
            ))}
          </div>
        </section>

        <section className="border-t-4 border-foreground pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">03</span>
              {copy.whatItDoes}
            </p>
          </FadeInLeft>

          <FadeInLeft delay={0.05}>
            <h2 className="mt-4 max-w-[42ch] font-heading text-xl leading-snug font-black tracking-tight text-foreground uppercase sm:mt-6 sm:text-2xl md:text-3xl lg:text-4xl">
              {copy.builtFor}
            </h2>
          </FadeInLeft>

          <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
            {copy.features.map((f, i) => (
              <FadeInUp key={f.label} delay={i * 0.07}>
                <div className="neo-card group flex h-full flex-col bg-card p-5 transition-all hover:bg-card sm:p-6">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-foreground bg-primary/10 shadow-[2px_2px_0_0_hsl(var(--shadow-color)/0.6)] transition-colors group-hover:bg-primary/15">
                      <f.icon className="h-4 w-4 text-primary/70 transition-colors group-hover:text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground sm:text-base">
                      {f.label}
                    </h4>
                  </div>
                  <p
                    className={`mt-4 text-sm leading-relaxed ${mutedTextClass}`}
                  >
                    {f.desc}
                  </p>
                </div>
              </FadeInUp>
            ))}
          </div>
        </section>

        {/* Video demo section with responsive media player */}
        <section
          id="demo-section"
          className="border-t-4 border-foreground pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32"
        >
          <FadeInLeft>
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">04</span>
              {copy.watchDemo}
            </p>
          </FadeInLeft>
          <FadeInLeft delay={0.05}>
            <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground uppercase sm:mt-3 sm:text-3xl">
              {copy.seeItWork}
            </h2>
          </FadeInLeft>

          <ScaleIn>
            <div className="relative mt-6 sm:mt-8 lg:pr-16">
              <DemoVideo src={DEMO_VIDEO_SRC} />
            </div>
          </ScaleIn>
        </section>

        {/* Tech stack section with responsive logo carousel */}
        <section className="border-t-4 border-foreground pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32">
          <FadeInLeft className="flex justify-center">
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">05</span>
              {copy.builtWith}
            </p>
          </FadeInLeft>
          <FadeInLeft delay={0.05}>
            <TechStackLogos
              techs={[
                { name: "Next.js", url: "https://nextjs.org" },
                { name: "FastAPI", url: "https://fastapi.tiangolo.com" },
                { name: "Pinecone", url: "https://pinecone.io" },
                { name: "Cohere", url: "https://cohere.com" },
                { name: "Groq", url: "https://groq.com" },
                { name: "Supabase", url: "https://supabase.com" },
              ]}
            />
          </FadeInLeft>
        </section>
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  )
}