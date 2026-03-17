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
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import {
  SiReact,
  SiNextdotjs,
  SiTypescript,
  SiTailwindcss,
  SiFastapi,
  SiLangchain,
} from "react-icons/si"
import { Badge } from "@/components/ui/badge"
import LogoLoop from "@/components/LogoLoop"
import TextType from "@/components/TextType"

export default function Home() {
  const techLogos = [
    { node: <SiReact />, title: "React", href: "https://react.dev" },
    { node: <SiNextdotjs />, title: "Next.js", href: "https://nextjs.org" },
    {
      node: <SiTypescript />,
      title: "TypeScript",
      href: "https://www.typescriptlang.org",
    },
    {
      node: <SiTailwindcss />,
      title: "Tailwind CSS",
      href: "https://tailwindcss.com",
    },
    {
      node: <SiFastapi />,
      title: "FastAPI",
      href: "https://fastapi.tiangolo.com",
    },
    {
      node: <SiLangchain />,
      title: "LangChain",
      href: "https://langchain.com",
    },
  ]

  // You can also add custom technology icons that aren't in react-icons
  const customTechLogos = [
    {
      node: <span className="text-2xl font-bold text-primary">ChromaDB</span>,
      title: "ChromaDB",
      href: "https://chromadb.com",
    },
    {
      node: <span className="text-2xl font-bold text-primary">bge-m3</span>,
      title: "BGE-M3",
      href: "https://huggingface.co/BAAI/bge-m3",
    },
    {
      node: <span className="text-2xl font-bold text-primary">Llama3</span>,
      title: "Llama 3",
      href: "https://llama.meta.com",
    },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-background via-background to-muted/20">
      <Navbar />
      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Column - Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            {/* Announcement Badge */}
            <div className="mb-6 inline-flex">
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/5 p-4"
              >
                <Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">
                  Powered by Multilingual AI
                </span>
              </Badge>
            </div>

            {/* Main Headline - Update gradient to use theme colors */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Chat with your
              <span className="relative ml-2 inline-block">
                <span className="relative z-10 bg-linear-to-r from-primary to-secondary-foreground bg-clip-text text-transparent">
                  documents
                </span>
                <span className="absolute right-0 -bottom-2 left-0 h-3 bg-primary/20 blur-xl" />
              </span>
            </h1>

            {/* Update TextType with theme-aware colors */}
            <TextType
              text={[
                "Upload PDFs and get instant answers in any language.",
                "Perfect for public services, research, and multilingual communities.",
                "Ask questions in English, Spanish, French, or any language!",
                "Your documents become instantly searchable and accessible.",
              ]}
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
                <span>PDF Support</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1.5 text-xs font-medium">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>RAG Architecture</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href={"workspace"}>
                <Button
                  size="lg"
                  className="relative overflow-hidden bg-primary px-8 text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
                >
                  <span className="relative z-10 flex items-center">
                    Try Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                  <span className="absolute inset-0 z-0 bg-linear-to-r from-primary to-purple-600 opacity-0 transition-opacity hover:opacity-100" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/20 bg-background/50 backdrop-blur-sm hover:bg-primary/5"
              >
                Watch Demo
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
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
                <div className="ml-2 text-xs text-muted-foreground">
                  LinguaRakyat • Chat Interface
                </div>
              </div>

              {/* Preview Content */}
              <div className="space-y-4 rounded-xl bg-background/60 p-4 backdrop-blur-sm">
                {/* Sample Messages */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary p-3 text-xs text-primary-foreground">
                    <p>What is this document about?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border/40 bg-card p-3 text-xs">
                    <p className="font-medium text-foreground">
                      This document outlines the Public Service Guidelines for
                      2024...
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                      <span>Source: Page 3, Paragraph 2</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary p-3 text-xs text-primary-foreground">
                    <p>Translate the summary to Malay</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border/40 bg-card p-3 text-xs">
                    <p className="font-medium text-foreground">
                      Dokumen ini menggariskan Garis Panduan Perkhidmatan Awam
                      2024...
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                      <Languages className="h-3 w-3" />
                      <span>Automatically translated from English</span>
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
              <p className="text-xs font-medium">Supported Languages</p>
              <p className="text-lg font-bold">4+</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="absolute -bottom-4 -left-2 rounded-lg border border-border/40 bg-background/80 p-3 backdrop-blur-xl md:-bottom-4 md:-left-4"
            >
              <p className="text-xs font-medium">Documents Processed</p>
              <p className="text-lg font-bold">10K+</p>
            </motion.div>
          </motion.div>
        </div>

        {/* Features Section */}
        <div
          id="features"
          className="mt-24 grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[
            {
              icon: Languages,
              title: "Multilingual Support",
              description:
                "Ask questions in Malay, English, Chinese, or Tamil - get answers in your preferred language.",
            },
            {
              icon: FileText,
              title: "Smart Document Processing",
              description:
                "Upload PDFs and our AI automatically indexes them for instant retrieval.",
            },
            {
              icon: Sparkles,
              title: "RAG Architecture",
              description:
                "Retrieval-Augmented Generation ensures accurate, source-cited answers every time.",
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
            <h2 className="text-2xl font-bold sm:text-3xl">How It Works</h2>
            <p className="mt-4 text-muted-foreground">
              Three simple steps to unlock your document's knowledge
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload Document",
                description:
                  "Drag and drop your PDF. We support multiple formats.",
                icon: FileText,
              },
              {
                step: "02",
                title: "Ask Questions",
                description:
                  "Type your question in any language. Our AI understands context.",
                icon: MessageSquare,
              },
              {
                step: "03",
                title: "Get Answers",
                description:
                  "Receive accurate, source-cited answers with translations.",
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
            Built with modern AI stack
          </h2>
          <p className="mt-4 text-muted-foreground">
            Powered by LangChain, ChromaDB, and state-of-the-art multilingual
            models
          </p>

          {/* Badge section - original */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
            {[
              "Next.js",
              "FastAPI",
              "LangChain",
              "ChromaDB",
              "bge-m3",
              "Llama3",
            ].map((tech) => (
              <Badge
                key={tech}
                variant="outline"
                className="border-primary/20 bg-primary/5 p-4 text-sm"
              >
                {tech}
              </Badge>
            ))}
          </div>

          {/* Animated logo loop section */}
          <div className="mt-16">
            <h3 className="mb-8 text-lg font-medium text-muted-foreground">
              Technologies we use
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
