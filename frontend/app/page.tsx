"use client"

import { motion } from "framer-motion"
import {
  Sparkles,
  FileText,
  MessageSquare,
  Languages,
  ArrowRight,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import Footer from "@/components/footer"
import { Badge } from "@/components/ui/badge"
import LogoLoop from "@/components/LogoLoop"
import TextType from "@/components/TextType"
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
import { useLanguage } from "@/components/language-provider"

// Import logo from public/icons folder
import logo from "@/public/icons/android-chrome-512x512.png"

export default function Home() {
  const { language } = useLanguage()
  const copy =
    language === "ms"
      ? {
          appName: "Lingua Rakyat",
          tagline: "AI untuk dokumen awam",
          heroBadge: "Dikuasakan AI Pelbagai Bahasa",
          heroTitleLead: "Tanya terus pada",
          heroTitleAccent: "dokumen anda",
          lines: [
            "Muat naik PDF dan dapatkan jawapan segera dalam bahasa pilihan anda.",
            "Sesuai untuk perkhidmatan awam, penyelidikan, dan komuniti berbilang bahasa.",
            "Tanya dalam Bahasa Melayu, English, Chinese, atau bahasa lain.",
            "Dokumen anda terus menjadi lebih mudah dicari dan difahami.",
          ],
          tryDemo: "Cuba Demo",
          watchDemo: "Tonton Demo",
        }
      : {
          appName: "Lingua Rakyat",
          tagline: "AI for public documents",
          heroBadge: "Powered by Multilingual AI",
          heroTitleLead: "Chat with your",
          heroTitleAccent: "documents",
          lines: [
            "Upload PDFs and get instant answers in any language.",
            "Perfect for public services, research, and multilingual communities.",
            "Ask questions in Malay, English, Chinese, or any language.",
            "Your documents become instantly searchable and accessible.",
          ],
          tryDemo: "Try Demo",
          watchDemo: "Watch Demo",
        }

  const techLogos = [
    {
      node: (
        <Image
          src="https://thesvg.org/icons/react/default.svg"
          alt="React"
          width={40}
          height={40}
        />
      ),
      title: "React",
      href: "https://react.dev",
    },
    {
      node: (
        <Image
          src="https://thesvg.org/icons/nextdotjs/default.svg"
          alt="Next.js"
          width={40}
          height={40}
        />
      ),
      title: "Next.js",
      href: "https://nextjs.org",
    },
    {
      node: (
        <Image
          src="https://thesvg.org/icons/typescript/default.svg"
          alt="TypeScript"
          width={40}
          height={40}
        />
      ),
      title: "TypeScript",
      href: "https://www.typescriptlang.org",
    },
    {
      node: (
        <Image
          src="https://thesvg.org/icons/tailwind-css/default.svg"
          alt="Tailwind CSS"
          width={40}
          height={40}
        />
      ),
      title: "Tailwind CSS",
      href: "https://tailwindcss.com",
    },
    {
      node: (
        <Image
          src="https://thesvg.org/icons/fastapi/default.svg"
          alt="FastAPI"
          width={40}
          height={40}
        />
      ),
      title: "FastAPI",
      href: "https://fastapi.tiangolo.com",
    },
    {
      node: (
        <Image
          src="https://thesvg.org/icons/langchain/default.svg"
          alt="LangChain"
          width={40}
          height={40}
        />
      ),
      title: "LangChain",
      href: "https://langchain.com",
    },
  ]

  const customTechLogos = [
    {
      node: (
        <Image
          src="https://thesvg.org/icons/pinecone/default.svg"
          alt="Pinecone"
          width={40}
          height={40}
        />
      ),
      title: "Pinecone",
      href: "https://pinecone.io",
    },
    {
      node: (
        <Image
          src="https://thesvg.org/icons/cohere/default.svg"
          alt="Cohere"
          width={40}
          height={40}
        />
      ),
      title: "Cohere",
      href: "https://cohere.com",
    },
    {
      node: (
        <Image
          src="https://thesvg.org/icons/groq/default.svg"
          alt="Groq"
          width={40}
          height={40}
        />
      ),
      title: "Groq",
      href: "https://groq.com",
    },
    {
      node: (
        <Image
          src="https://thesvg.org/icons/supabase/default.svg"
          alt="Supabase"
          width={40}
          height={40}
        />
      ),
      title: "Supabase",
      href: "https://supabase.com",
    },
  ]

  const techStackItems = [
    { name: "Next.js", url: "https://nextjs.org" },
    { name: "FastAPI", url: "https://fastapi.tiangolo.com" },
    { name: "LangChain", url: "https://langchain.com" },
    { name: "Pinecone", url: "https://pinecone.io" },
    { name: "Cohere", url: "https://cohere.com" },
    { name: "Groq", url: "https://groq.com" },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:pt-20">
        {/* Logo and Title Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16 flex flex-col items-center justify-center text-center"
        >
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
              <Image
                src={logo}
                alt="Lingua Rakyat logo"
                width={64}
                height={64}
                className="rounded-full"
              />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-linear-to-r from-primary to-foreground bg-clip-text text-transparent">
              {copy.appName}
            </span>
          </h1>
          <p className="mt-2 text-sm tracking-wider text-muted-foreground uppercase">
            {copy.tagline}
          </p>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Column - Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-col justify-center"
          >
            {/* Announcement Badge */}
            <div className="mb-6 inline-flex">
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/5 p-4"
              >
                <Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">{copy.heroBadge}</span>
              </Badge>
            </div>

            {/* Main Headline */}
            <h2 className="text-4xl font-bold tracking-tight capitalize sm:text-5xl lg:text-6xl">
              {copy.heroTitleLead}
              <span className="relative ml-2 inline-block">
                <span className="relative z-10 bg-linear-to-r from-primary to-foreground bg-clip-text text-transparent">
                  {copy.heroTitleAccent}
                </span>
                <span className="absolute right-0 -bottom-2 left-0 h-3 bg-primary/20 blur-xl" />
              </span>
            </h2>

            {/* TextType */}
            <TextType
              text={copy.lines}
              typingSpeed={40}
              deletingSpeed={20}
              pauseDuration={2500}
              loop={true}
              showCursor={true}
              cursorCharacter="_"
              cursorBlinkDuration={0.5}
              className="mt-6 min-h-20 text-lg text-muted-foreground sm:text-xl"
              textColors={[
                "var(--muted-foreground)",
                "var(--muted-foreground)",
                "var(--muted-foreground)",
                "var(--muted-foreground)",
              ]}
              startOnVisible={true}
            />

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1.5 text-xs font-medium">
                <Languages className="h-3.5 w-3.5 text-primary" />
                <span>Malay • English • Chinese • Tamil</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1.5 text-xs font-medium">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>
                  {language === "ms" ? "Sokongan PDF" : "PDF Support"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1.5 text-xs font-medium">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>
                  {language === "ms" ? "Seni Bina RAG" : "RAG Architecture"}
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href={"/workspace"}>
                <Button
                  size="lg"
                  className="relative overflow-hidden bg-primary px-8 text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
                >
                  <span className="relative z-10 flex items-center">
                    {copy.tryDemo}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/20 bg-background/50 backdrop-blur-sm hover:bg-primary/5"
                onClick={() =>
                  document
                    .getElementById("demo-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {copy.watchDemo}
              </Button>
            </div>
          </motion.div>

          {/* Right Column - Preview/Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl border border-border/50 bg-linear-to-br from-background via-background to-muted/30 p-2 shadow-2xl backdrop-blur-sm">
              {/* Window Controls */}
              <div className="mb-3 flex items-center gap-2 px-3 pt-3">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-primary/80" />
                <div className="ml-2 text-xs text-muted-foreground">
                  LinguaRakyat • Chat Interface
                </div>
              </div>

              {/* Preview Content */}
              <div className="space-y-4 rounded-xl bg-background/60 p-4 backdrop-blur-sm">
                {/* Sample Messages */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary p-3 text-xs text-primary-foreground">
                    <p>
                      {language === "ms"
                        ? "Dokumen ini tentang apa?"
                        : "What is this document about?"}
                    </p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border/40 bg-card p-3 text-xs">
                    <p className="font-medium text-foreground">
                      {language === "ms"
                        ? "Dokumen ini menerangkan Garis Panduan Perkhidmatan Awam 2024..."
                        : "This document explains the Public Service Guidelines 2024..."}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                      <span>
                        {language === "ms"
                          ? "Sumber: Halaman 3, Perenggan 2"
                          : "Source: Page 3, Paragraph 2"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary p-3 text-xs text-primary-foreground">
                    <p>
                      {language === "ms"
                        ? "Terjemahkan ringkasan ini ke Bahasa Melayu"
                        : "Translate this summary to Malay"}
                    </p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border/40 bg-card p-3 text-xs">
                    <p className="font-medium text-foreground">
                      {language === "ms"
                        ? "Dokumen ini menggariskan Garis Panduan Perkhidmatan Awam 2024..."
                        : "This document outlines the Public Service Guidelines 2024..."}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                      <Languages className="h-3 w-3" />
                      <span>
                        {language === "ms"
                          ? "Diterjemah secara automatik daripada English"
                          : "Automatically translated from English"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Input Preview */}
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-border/40 bg-background/80 p-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 p-1.5">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="h-8 flex-1 rounded-lg bg-muted/30" />
                  <div className="h-8 w-8 rounded-lg bg-primary/10 p-2">
                    <Send className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="absolute -top-4 -right-2 rounded-lg border border-border/40 bg-background/80 p-3 backdrop-blur-xl md:-top-4 md:-right-6"
            >
              <p className="text-xs font-medium">
                {language === "ms" ? "Bahasa Disokong" : "Languages Supported"}
              </p>
              <p className="text-lg font-bold">4+</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="absolute -bottom-4 -left-2 rounded-lg border border-border/40 bg-background/80 p-3 backdrop-blur-xl md:-bottom-4 md:-left-4"
            >
              <p className="text-xs font-medium">
                {language === "ms" ? "Dokumen Diproses" : "Documents Processed"}
              </p>
              <p className="text-lg font-bold">10K+</p>
            </motion.div>
          </motion.div>
        </div>

        {/* Video Showcase Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mt-24 py-5"
          id="demo-section"
        >
          <div className="mb-8 text-center">
            <Badge className="mb-4 border-primary/20 p-4">
              {language === "ms" ? "Tonton Demo" : "Watch Demo"}
            </Badge>
            <h2 className="text-2xl font-bold sm:text-3xl">
              {language === "ms"
                ? "Lihat LinguaRakyat berfungsi"
                : "See LinguaRakyat in action"}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              {language === "ms"
                ? "Lihat bagaimana anda boleh berinteraksi dengan dokumen, bertanya dalam pelbagai bahasa, dan menerima jawapan tepat dengan petikan sumber."
                : "See how you can interact with documents, ask questions in multiple languages, and receive accurate answers with source citations."}
            </p>
          </div>

          <div className="relative rounded-2xl border border-border/50 bg-linear-to-br from-background via-background to-muted/30 p-3 shadow-2xl backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2 px-4 pt-3">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-primary/80" />
              </div>
              <div className="ml-2 text-xs font-medium text-muted-foreground">
                LinguaRakyat Demo
              </div>
            </div>

            <div className="overflow-hidden rounded-xl">
              <MediaPlayer>
                <MediaPlayerVideo className="aspect-video">
                  <source
                    src="https://stream.mux.com/VZtzUzGRv02OhRnZCxcNg49OilvolTqdnFLEqBsTwaxU/medium.mp4"
                    type="video/mp4"
                  />
                  {language === "ms"
                    ? "Pelantar video tidak disokong oleh pelayar anda."
                    : "Your browser does not support the video tag."}
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

            <div className="mt-6 grid grid-cols-3 gap-4 px-4 pb-4">
              {[
                {
                  label: language === "ms" ? "Pelbagai Bahasa" : "Languages",
                  value: language === "ms" ? "4+ bahasa" : "4+ languages",
                },
                {
                  label: language === "ms" ? "Masa Respons" : "Response Time",
                  value: "< 2 saat",
                },
                {
                  label: language === "ms" ? "Ketepatan" : "Accuracy",
                  value: "99.9%",
                },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Features Section */}
        <div
          id="features"
          className="mt-24 grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[
            {
              icon: Languages,
              title:
                language === "ms"
                  ? "Sokongan Pelbagai Bahasa"
                  : "Multilingual Support",
              description:
                language === "ms"
                  ? "Tanya dalam Bahasa Melayu, English, Chinese, atau Tamil dan terima jawapan dalam bahasa pilihan anda."
                  : "Ask in Malay, English, Chinese, or Tamil and receive answers in your preferred language.",
            },
            {
              icon: FileText,
              title:
                language === "ms"
                  ? "Pemprosesan Dokumen Pintar"
                  : "Smart Document Processing",
              description:
                language === "ms"
                  ? "Muat naik PDF dan AI akan mengindeks kandungan secara automatik untuk carian segera."
                  : "Upload PDFs and AI will automatically index content for instant search.",
            },
            {
              icon: Sparkles,
              title: language === "ms" ? "Seni Bina RAG" : "RAG Architecture",
              description:
                language === "ms"
                  ? "Retrieval-Augmented Generation membantu menghasilkan jawapan yang lebih tepat dan bersumber."
                  : "Retrieval-Augmented Generation helps produce more accurate, sourced answers.",
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group rounded-xl border border-border/40 bg-background/50 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* How It Works Section */}
        <div className="mt-24">
          <div className="text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              {language === "ms" ? "Cara Ia Berfungsi" : "How It Works"}
            </h2>
            <p className="mt-4 text-muted-foreground">
              {language === "ms"
                ? "Tiga langkah ringkas untuk membuka maklumat dalam dokumen anda"
                : "Three simple steps to unlock information in your documents"}
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title:
                  language === "ms" ? "Muat Naik Dokumen" : "Upload Document",
                description:
                  language === "ms"
                    ? "Seret dan lepas fail PDF anda untuk diproses."
                    : "Drag and drop your PDF file for processing.",
                icon: FileText,
              },
              {
                step: "02",
                title: language === "ms" ? "Tanya Soalan" : "Ask Questions",
                description:
                  language === "ms"
                    ? "Taip soalan dalam bahasa pilihan anda. AI memahami konteks dokumen."
                    : "Type your question in your preferred language. AI understands document context.",
                icon: MessageSquare,
              },
              {
                step: "03",
                title: language === "ms" ? "Dapatkan Jawapan" : "Get Answers",
                description:
                  language === "ms"
                    ? "Terima jawapan yang tepat, bersumber, dan boleh diterjemah."
                    : "Receive accurate, sourced answers that can be translated.",
                icon: Sparkles,
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="relative"
              >
                <div className="absolute -top-8 left-4 z-30 text-6xl font-bold text-primary/30">
                  {item.step}
                </div>
                <div className="relative min-h-[16vh] rounded-xl border border-border/40 bg-card/50 p-6 backdrop-blur-sm">
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tech Stack Section */}
        <div className="mt-24 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            {language === "ms"
              ? "Dibina dengan timbunan AI moden"
              : "Built with modern AI stack"}
          </h2>

          <div className="mt-4 text-muted-foreground">
            {language === "ms" ? "Dikuasakan oleh" : "Powered by"}{" "}
            <LinkPreview
              url="https://langchain.com"
              className="inline-block font-medium text-primary hover:underline"
            >
              LangChain
            </LinkPreview>
            ,{" "}
            <LinkPreview
              url="https://pinecone.io"
              className="inline-block font-medium text-primary hover:underline"
            >
              Pinecone
            </LinkPreview>
            ,{" "}
            <LinkPreview
              url="https://groq.com"
              className="inline-block font-medium text-primary hover:underline"
            >
              Groq
            </LinkPreview>
            , {language === "ms" ? "dan" : "and"}{" "}
            <LinkPreview
              url="https://cohere.com"
              className="inline-block font-medium text-primary hover:underline"
            >
              Cohere
            </LinkPreview>{" "}
            {language === "ms" ? "untuk RAG lanjutan" : "for advanced RAG"}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
            {techStackItems.map((tech) => (
              <LinkPreview key={tech.name} url={tech.url}>
                <Badge
                  variant="outline"
                  className="cursor-pointer border-primary/20 bg-primary/5 p-4 text-sm transition-all hover:border-primary/40 hover:bg-primary/10"
                >
                  {tech.name}
                </Badge>
              </LinkPreview>
            ))}
          </div>

          <div className="mt-16">
            <h3 className="mb-8 text-lg font-medium text-muted-foreground">
              {language === "ms"
                ? "Teknologi yang digunakan"
                : "Technologies we use"}
            </h3>
            <div className="relative">
              <div className="mb-12">
                <LogoLoop
                  logos={techLogos}
                  speed={80}
                  direction="left"
                  logoHeight={50}
                  gap={80}
                  hoverSpeed={0.2}
                  scaleOnHover
                  fadeOut
                  fadeOutColor="var(--background)"
                  ariaLabel="Technology partners row 1"
                />
              </div>

              <div className="mb-12">
                <LogoLoop
                  logos={customTechLogos}
                  speed={60}
                  direction="right"
                  logoHeight={50}
                  gap={100}
                  hoverSpeed={0.2}
                  scaleOnHover
                  fadeOut
                  fadeOutColor="var(--background)"
                  ariaLabel="Technology partners row 2"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
