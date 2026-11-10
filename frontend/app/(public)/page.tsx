"use client"

import CivicBackground from "@/components/civic-background"
import HeroText from "@/components/ui/hero-shutter-text"

import { UiText, useTranslations } from "@/components/i18n"
import dynamic from "next/dynamic"
import { motion, useReducedMotion } from "framer-motion"
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
  Zap,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"

import { LocalizedLink as Link } from "@/components/i18n"
import { Instrument_Serif } from "next/font/google"
import Footer from "@/components/footer"
import { useLanguage } from "@/components/language-provider"

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

const editorialSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "normal",
  display: "swap",
})

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
  const t = useTranslations()

  const { language } = useLanguage()
  const shouldReduce = useReducedMotion()

  const mutedTextClass = "text-muted-foreground"

  const copy =
    language === "ms"
      ? {
          kicker: "AI Multilingual untuk Dokumen Kerajaan",
          headline1: "Dokumen kerajaan.",
          headline2: "Dalam bahasa anda.",

          subhead:
            "Tanya tentang dokumen kerajaan Malaysia dalam Bahasa Melayu, English atau Mandarin. Baca penerangan dan semak petikan sumber yang disertakan.",

          cta: "Tanya soalan",
          ctaSecondary: "Tonton Demo",

          strip: [
            { icon: FileSearch, label: "Carian Semantik" },
            { icon: BarChart3, label: "ROUGE-1/2/L" },
            { icon: Zap, label: "Inferens Pantas" },
            { icon: Target, label: "Skor Keyakinan" },
          ],

          howItWorks: "Cara jawapan dihasilkan",

          steps: [
            {
              n: "01",
              title: "Ingestion",
              desc: "Sistem mengekstrak teks PDF, membahagikannya kepada petikan dan mengindeksnya untuk carian.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "Sistem mencari petikan yang sepadan dengan soalan anda, kemudian menyusunnya mengikut kesesuaian.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "Sistem menyemak bukti yang ditemui, menjana jawapan dan menyertakan petikan sumber serta skor penilaian jawapan.",
              icon: FileSearch,
            },
          ],

          whatItDoes: "Alat untuk membaca dokumen",

          builtFor:
            "Tanya soalan, semak sumber dan lihat cara jawapan dinilai.",

          features: [
            {
              label: "Jawapan pelbagai bahasa",
              desc: "Tanya soalan dan baca jawapan dalam Bahasa Melayu, English atau Mandarin.",
              icon: Globe,
            },
            {
              label: "Penilaian jawapan",
              desc: "ROUGE, BLEU, Flesch-Kincaid, exact match, serta metrik masa nyata.",
              icon: BarChart3,
            },
            {
              label: "Tanya dan dengar melalui suara",
              desc: "Tanya soalan melalui suara dan dengar jawapan dibacakan.",
              icon: Mic,
            },
            {
              label: "Semakan bukti",
              desc: "Menyemak bukti sebelum menjawab dan menilai sejauh mana jawapan mengikuti sumbernya.",
              icon: Shield,
            },
          ],

          watchDemo: "Tonton demo",
          seeItWork: "Soal jawab menggunakan dokumen kerajaan",

          builtWith: "Teknologi",

          previewQ: "Soalan: Siapakah yang layak memohon bantuan ini?",
          previewA:
            "Dalam contoh rekaan ini, Seksyen 2.1 menetapkan kewarganegaraan Malaysia, umur minimum 18 tahun dan had pendapatan isi rumah RM4,000.",
          sampleTitle: "Lihat contoh jawapan",
          sampleDescription:
            "Jawapan dipadankan dengan petikan sumber supaya anda boleh menyemaknya.",
          sampleCta: "Tanya soalan anda",
          sampleNote: "Pratonton contoh — bukan nasihat rasmi",
          previewSrc: "Petikan sumber · Pratonton",
        }
      : {
          kicker: "Multilingual AI for Government Documents",

          headline1: "Government documents.",
          headline2: "In your language.",

          subhead:
            "Ask about Malaysian government documents in Malay, English or Chinese. Read an explanation and check the source passages included with the answer.",

          cta: "Ask a question",
          ctaSecondary: "Watch Demo",

          strip: [
            { icon: FileSearch, label: "Semantic Search" },
            { icon: BarChart3, label: "ROUGE-1/2/L" },
            { icon: Zap, label: "Fast Inference" },
            { icon: Target, label: "Confidence Scoring" },
          ],

          howItWorks: "How answers are produced",

          steps: [
            {
              n: "01",
              title: "Ingestion",
              desc: "The system extracts text from PDFs, splits it into passages and indexes them for search.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "The system searches for passages that match your question, then ranks them by relevance.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "The system checks the matching passages and writes an answer with source citations and evaluation scores.",
              icon: FileSearch,
            },
          ],

          whatItDoes: "Tools for reading documents",

          builtFor:
            "Ask questions, check sources and see how answers are evaluated.",

          features: [
            {
              label: "Multilingual answers",
              desc: "Ask questions and read answers in Malay, English or Chinese.",
              icon: Globe,
            },
            {
              label: "Answer evaluation",
              desc: "ROUGE, BLEU, Flesch-Kincaid, exact match, and real-time metrics.",
              icon: BarChart3,
            },
            {
              label: "Ask and listen by voice",
              desc: "Ask a question by voice and listen to the answer read aloud.",
              icon: Mic,
            },
            {
              label: "Evidence checks",
              desc: "Checks the source passages before answering and scores how closely the answer follows them.",
              icon: Shield,
            },
          ],

          watchDemo: "Watch the demo",
          seeItWork: "Questions and answers with government documents",

          builtWith: "Technology",

          previewQ: "Who is eligible to apply for this benefit?",
          previewA:
            "In this example, Section 2.1 requires Malaysian citizenship, an age of at least 18 and household income of RM4,000 or less.",
          sampleTitle: "See a sample answer",
          sampleDescription:
            "Read the answer alongside its source passage to check the details.",
          sampleCta: "Ask your own question",
          sampleNote: "Example preview — not official guidance",
          previewSrc: "Source excerpt · Preview",
        }
  const comparison =
    language === "ms"
      ? {
          kicker: "Document Q&A comparison",
          title: "Soal jawab dokumen dengan sumber untuk disemak.",
          subhead:
            "Bandingkan sokongan bahasa, petikan sumber dan alat untuk menyemak jawapan.",
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
            "Nota: Sambungan internet diperlukan untuk mengakses dokumen dan jawapan.",
        }
      : {
          kicker: "Document Q&A comparison",
          title: "Document questions, with sources you can check.",
          subhead:
            "Compare language support, source citations and tools for reviewing answers.",
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
              label: "PDF citations and pages",
              values: [true, true, true, true],
            },
            {
              label: "Confidence badge",
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
              label: "Answer evaluation metrics",
              values: [true, false, false, false],
            },
            {
              label: "Answer-to-source comparison",
              values: [true, false, false, false],
            },
            {
              label: "Voice questions and playback",
              values: [true, true, true, false],
            },
          ],
          footnote:
            "Note: An internet connection is required to access documents and answers.",
        }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background">
      <main className="landing-service relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10">
        <section className="editorial-hero relative left-1/2 isolate w-screen -translate-x-1/2 text-center">
          <CivicBackground language={language} />
          <div className="mx-auto flex min-h-[560px] w-full max-w-4xl flex-col items-center justify-center px-4 py-12 sm:min-h-[620px] sm:px-6">
            <p className="mb-7 flex flex-wrap justify-center gap-x-3 text-[10px] font-semibold tracking-[.25em] text-muted-foreground uppercase">
              {(language === "ms"
                ? ["Dokumen", "Bahasa", "Kefahaman"]
                : ["Documents", "Language", "Understanding"]
              ).map((word, i) => (
                <span
                  className="editorial-rise"
                  style={{ animationDelay: i * 400 + "ms" }}
                  key={word}
                >
                  {word}
                </span>
              ))}
            </p>
            <h1
              className={
                editorialSerif.className +
                " w-full max-w-[18ch] text-[clamp(2.25rem,6.8vw,6rem)] leading-[1.05] font-normal tracking-[-.015em] text-balance"
              }
            >
              <HeroText
                key={language}
                text={copy.headline1 + " " + copy.headline2}
              />
            </h1>
            <div
              aria-hidden="true"
              className="editorial-rule mt-8 h-px w-20 bg-foreground/20"
            />
            <p
              className="editorial-rise mx-auto mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-[17px]"
              style={{ animationDelay: "1500ms" }}
            >
              {copy.subhead}
            </p>
            <div
              className="editorial-rise mt-9 flex flex-col items-center gap-5 sm:flex-row sm:gap-8"
              style={{ animationDelay: "1700ms" }}
            >
              <Button asChild className="rounded-sm px-7 py-6">
                <Link href="/workspace">
                  {copy.cta}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <a
                href="#demo-section"
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {language === "ms"
                  ? t("Lihat cara ia berfungsi")
                  : t("See how it works")}{" "}
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
        </section>
        <section
          aria-label={
            language === "ms"
              ? t("Cara menggunakan Lingua Rakyat")
              : t("How Lingua Rakyat works")
          }
          className="service-guide my-10 grid gap-6 border-y border-border bg-transparent py-6 sm:my-16 md:grid-cols-[1.2fr_1fr_1fr] md:gap-8"
        >
          {[
            [
              "01",
              language === "ms"
                ? "Tanya dalam bahasa anda"
                : "Ask in your language",
              language === "ms"
                ? "Mulakan dengan soalan tentang dokumen awam."
                : "Start with a question about public documents.",
            ],
            [
              "02",
              language === "ms" ? "Fahami jawapan" : "Understand the answer",
              language === "ms"
                ? "Dapatkan penerangan yang jelas dan mudah dibaca."
                : "Get a clear explanation you can follow.",
            ],
            [
              "03",
              language === "ms" ? "Semak sumber" : "Check the source",
              language === "ms"
                ? "Rujuk petikan dan sahkan dengan sumber rasmi."
                : "Follow citations and verify with official sources.",
            ],
          ].map(([step, title, description]) => (
            <div key={step} className="flex gap-3">
              <span className="font-mono text-xs text-primary">{step}</span>
              <div>
                <h2 className="text-sm font-semibold">
                  {<UiText text={title} />}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {<UiText text={description} />}
                </p>
              </div>
            </div>
          ))}
        </section>

        <FadeInUp>
          <section className="mx-auto grid max-w-5xl items-center gap-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12 lg:py-16">
            <div className="max-w-md">
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                {language === "ms"
                  ? "Jawapan bersumber"
                  : "Answers with sources"}
              </p>
              <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {copy.sampleTitle}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {copy.sampleDescription}
              </p>
              <Button asChild className="mt-6 rounded-md">
                <Link href="/workspace">
                  {copy.sampleCta}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>

            <div className="min-w-0">
              <Terminal
                compact
                className="rounded-xl border-border bg-zinc-950 text-zinc-100 shadow-sm"
              >
                <AnimatedSpan className="flex items-center gap-2 text-xs text-zinc-400">
                  <FileText className="size-3.5 shrink-0" />
                  <span className="font-medium tracking-wide">
                    {language === "ms" ? "Pratonton jawapan" : "Answer preview"}
                  </span>
                </AnimatedSpan>

                <div className="font-mono text-xs leading-relaxed">
                  <span className="mr-2 font-bold text-primary">›</span>
                  <TypingAnimation className="text-zinc-100">
                    {copy.previewQ}
                  </TypingAnimation>
                </div>

                <AnimatedSpan className="rounded-md bg-zinc-900 px-3 py-3 text-zinc-100">
                  <p className="text-xs leading-relaxed sm:text-sm">
                    {copy.previewA}
                  </p>
                  <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-400">
                    <BookOpen className="size-3 shrink-0" />
                    <span>{copy.previewSrc}</span>
                  </div>
                </AnimatedSpan>

                <AnimatedSpan className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {copy.sampleNote}
                </AnimatedSpan>
              </Terminal>
            </div>
          </section>
        </FadeInUp>

        <section className="border-t border-border pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">01</span>
              {comparison.kicker}
            </p>
          </FadeInLeft>

          <FadeInLeft delay={0.05}>
            <h2 className="mt-4 max-w-[32ch] font-heading text-2xl font-semibold tracking-tight text-foreground sm:mt-5 sm:text-3xl lg:text-4xl">
              {<UiText text={comparison.title} />}
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
            <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="border-r border-border px-4 py-3.5 text-left text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase sm:w-[320px]">
                      {" "}
                      <UiText text="Feature" />{" "}
                    </th>
                    {comparison.columns.map((col, colIdx) => (
                      <th
                        key={col}
                        className={[
                          "border-r border-border px-4 py-3.5 text-left text-[11px] font-bold tracking-[0.2em] uppercase last:border-r-0",
                          colIdx === 0
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row, rowIdx) => (
                    <tr
                      key={row.label}
                      className={[
                        "border-b border-border transition-colors hover:bg-muted/30",
                        rowIdx === comparison.rows.length - 1 && "border-b-0",
                      ].join(" ")}
                    >
                      <td className="border-r border-border px-4 py-3 font-medium text-foreground/90 sm:px-4">
                        {<UiText text={row.label} />}
                      </td>
                      {row.values.map((value: boolean, idx: number) => (
                        <td
                          key={idx}
                          className={[
                            "border-r border-border px-4 py-3 text-center last:border-r-0 sm:px-4",
                            idx === 0 ? "bg-primary/5" : "",
                          ].join(" ")}
                        >
                          {value ? (
                            <span className="inline-flex items-center justify-center font-bold text-primary">
                              <Check className="h-4 w-4" strokeWidth={2.5} />
                              <span className="sr-only">
                                <UiText text="yes" />
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">
                              {" "}
                              <UiText text="—" />{" "}
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

        <section className="border-t border-border pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">02</span>
              {copy.howItWorks}
            </p>
          </FadeInLeft>

          <div className="mt-8 grid gap-0 border-t border-border sm:mt-12">
            {copy.steps.map((step, i) => (
              <FadeInUp key={step.n} delay={i * 0.1}>
                <motion.div
                  className={`group relative overflow-hidden border-b border-border py-8 pr-12 sm:pl-20`}
                  whileHover={shouldReduce ? {} : { y: -4, scale: 1.012 }}
                  whileTap={shouldReduce ? {} : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                >
                  <span className="absolute top-8 right-1 font-mono text-sm text-muted-foreground sm:right-auto sm:left-0">
                    {step.n}
                  </span>
                  <step.icon className="relative mb-4 h-5 w-5 text-primary/70 transition-all group-hover:scale-110 group-hover:text-primary sm:h-6 sm:w-6" />
                  <h3 className="relative font-heading text-lg font-semibold text-foreground sm:text-xl">
                    {<UiText text={step.title} />}
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

        <section className="border-t border-border pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32">
          <FadeInLeft>
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">03</span>
              {copy.whatItDoes}
            </p>
          </FadeInLeft>

          <FadeInLeft delay={0.05}>
            <h2 className="mt-4 max-w-[42ch] font-heading text-xl leading-snug font-semibold tracking-tight text-foreground sm:mt-6 sm:text-2xl md:text-3xl lg:text-4xl">
              {copy.builtFor}
            </h2>
          </FadeInLeft>

          <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2">
            {copy.features.map((f, i) => (
              <FadeInUp key={f.label} delay={i * 0.07}>
                <div className="group flex h-full flex-col border-t border-border py-6 sm:pr-8">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <f.icon className="h-4 w-4 text-primary/70 transition-colors group-hover:text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground sm:text-base">
                      {<UiText text={f.label} />}
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

        <section
          id="demo-section"
          className="border-t border-border pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32"
        >
          <FadeInLeft>
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">04</span>
              {copy.watchDemo}
            </p>
          </FadeInLeft>
          <FadeInLeft delay={0.05}>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground sm:mt-3 sm:text-3xl">
              {copy.seeItWork}
            </h2>
          </FadeInLeft>

          <ScaleIn>
            <div className="relative mt-6 sm:mt-8 lg:pr-16">
              <DemoVideo src={DEMO_VIDEO_SRC} />
            </div>
          </ScaleIn>
        </section>

        <section className="border-t border-border pt-14 pb-16 sm:pt-16 sm:pb-24 lg:pb-32">
          <FadeInLeft className="block">
            <p className="mt-5 inline-flex items-center bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-secondary-foreground uppercase">
              <span className="mr-2 text-secondary-foreground/60">05</span>
              {copy.builtWith}
            </p>
            <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {language === "ms"
                ? t("Teknologi yang digunakan oleh Lingua Rakyat")
                : t("Technology used by Lingua Rakyat")}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {language === "ms"
                ? t(
                    "Alat yang digunakan oleh Lingua Rakyat untuk menyimpan dokumen, mencari petikan dan menjana jawapan."
                  )
                : t(
                    "The tools Lingua Rakyat uses to store documents, search passages and write answers."
                  )}
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
