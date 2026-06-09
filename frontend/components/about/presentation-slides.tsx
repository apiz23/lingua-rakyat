// frontend/components/about/presentation-slides.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Play, Pause, X, ChevronLeft, ChevronRight,
  ArrowRight, Check, FileText,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  BACKEND_STACK,
  FRONTEND_STACK,
  EVAL_METRICS,
  KEY_FEATURES,
  INGESTION_STEPS,
  QA_STEPS,
} from "@/app/(app)/about/data"

// ── Constants ──────────────────────────────────────────────────────────────

const SLIDE_LABELS = [
  "Overview",
  "Ingestion Pipeline",
  "Q&A Pipeline",
  "Tech Stack",
  "Key Features",
  "Eval Metrics",
]
const TOTAL = SLIDE_LABELS.length

// ── Slide content components ───────────────────────────────────────────────

function SlideOverview() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-8">
      <div className="grid flex-1 gap-4 sm:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center bg-red-500/10">
              <FileText className="h-3.5 w-3.5 text-red-500" />
            </div>
            <span className="text-sm font-semibold text-foreground">The Problem</span>
          </div>
          <ul className="space-y-2">
            {[
              "Government PDFs written in legalese — not plain language",
              "Long documents with no searchable Q&A interface",
              "No equal access across Malay, English, and Chinese speakers",
              "Eligibility criteria buried in paragraphs",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-primary/25 bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center bg-primary/10">
              <Check className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">The Solution</span>
          </div>
          <ul className="space-y-2">
            {[
              "Upload any government PDF — queryable instantly",
              "Ask in Malay, English, or Mandarin — answer in same language",
              "Every answer grounded in document text with page citations",
              "Evidence guard refuses to hallucinate — shows confidence",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border border-primary/15 bg-primary/5 px-5 py-4">
        <p className="text-sm text-foreground/80">
          <span className="font-semibold text-primary">RAG in one sentence: </span>
          Instead of an LLM guessing from training memory, Lingua Rakyat first searches the actual
          document for relevant passages, then passes only those passages to the LLM — so the answer
          is always traceable to a real source.
        </p>
      </div>
    </div>
  )
}

function SlidePipeline({
  steps,
}: {
  steps: typeof INGESTION_STEPS
}) {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="space-y-0">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isLast = i === steps.length - 1
          return (
            <div key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-primary/20 bg-primary/8 text-xs font-bold text-primary">
                  {step.n}
                </div>
                {!isLast && <div className="mt-0.5 w-px flex-1 bg-border/50" />}
              </div>
              <div className={cn("min-w-0 flex-1 pb-4", isLast && "pb-0")}>
                <div className="mb-1 flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                  <span className="text-sm font-semibold text-foreground">{step.title}</span>
                </div>
                <ul className="space-y-0.5">
                  {step.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary/40" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlideTechStack() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Backend
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BACKEND_STACK.map((tech) => (
              <div key={tech.name} className="border border-border/60 bg-card/40 px-3 py-2">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">{tech.name}</span>
                  <Badge className={cn("border text-[10px] font-medium", tech.color)}>
                    {tech.role}
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  <span className="font-medium text-primary/80">Why: </span>{tech.why}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Frontend &amp; Deployment
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FRONTEND_STACK.map((tech) => (
              <div key={tech.name} className="border border-border/60 bg-card/40 px-3 py-2">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">{tech.name}</span>
                  <Badge className={cn("border text-[10px] font-medium", tech.color)}>
                    {tech.role}
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  <span className="font-medium text-primary/80">Why: </span>{tech.why}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideFeatures() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {KEY_FEATURES.map((feat) => {
          const Icon = feat.icon
          return (
            <div key={feat.label} className="border border-border/60 bg-card/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className={cn("flex h-6 w-6 items-center justify-center", feat.bg)}>
                  <Icon className={cn("h-3.5 w-3.5", feat.color)} />
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
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlideMetrics() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {EVAL_METRICS.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.name} className="border border-border/60 bg-card/40 p-4">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary/60" />
                  <span className="text-sm font-semibold text-foreground">{m.name}</span>
                </div>
                <Badge variant="outline" className="shrink-0 border-border/60 font-mono text-[10px] text-muted-foreground">
                  {m.range}
                </Badge>
              </div>
              <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground">{m.what}</p>
              <p className="border border-border/40 bg-muted/20 px-2 py-1 text-[11px] leading-relaxed text-muted-foreground">
                {m.detail}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Slide registry ─────────────────────────────────────────────────────────

const SLIDES = [
  <SlideOverview key="overview" />,
  <SlidePipeline key="ingestion" steps={INGESTION_STEPS} />,
  <SlidePipeline key="qa" steps={QA_STEPS} />,
  <SlideTechStack key="tech" />,
  <SlideFeatures key="features" />,
  <SlideMetrics key="metrics" />,
]

// ── Main component ─────────────────────────────────────────────────────────

interface PresentationSlidesProps {
  open: boolean
  onClose: () => void
}

export function PresentationSlides({ open, onClose }: PresentationSlidesProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setCurrentSlide(0)
      setIsPlaying(true)
    }
  }, [open])

  const goTo = useCallback((idx: number) => {
    setCurrentSlide(Math.max(0, Math.min(TOTAL - 1, idx)))
  }, [])

  // Autoplay — restarts whenever currentSlide or isPlaying changes
  useEffect(() => {
    if (!open || !isPlaying) return
    const id = setInterval(() => {
      setCurrentSlide((c) => {
        if (c >= TOTAL - 1) {
          setIsPlaying(false)
          return c
        }
        return c + 1
      })
    }, 5000)
    return () => clearInterval(id)
  }, [open, isPlaying, currentSlide])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          setCurrentSlide((c) => Math.max(0, c - 1))
          setIsPlaying(false)
          break
        case "ArrowRight":
          setCurrentSlide((c) => Math.min(TOTAL - 1, c + 1))
          setIsPlaying(false)
          break
        case " ":
          e.preventDefault()
          setIsPlaying((p) => !p)
          break
        case "Escape":
          onClose()
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col gap-3 bg-black/92 p-3">

      {/* Top bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Lingua Rakyat — Presentation
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? "Pause autoplay" : "Resume autoplay"}
            aria-pressed={isPlaying}
            className={cn(
              "flex h-8 w-8 items-center justify-center border text-xs transition-colors focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:outline-none",
              isPlaying
                ? "border-primary bg-primary text-white"
                : "border-white/20 bg-white/8 text-white/60 hover:bg-white/12",
            )}
          >
            {isPlaying
              ? <Pause className="h-3.5 w-3.5" />
              : <Play className="h-3.5 w-3.5" />
            }
          </button>
          <span className="text-[11px] text-white/35">5s</span>
          <button
            onClick={onClose}
            aria-label="Close presentation"
            className="flex h-8 w-8 items-center justify-center border border-white/20 bg-white/8 text-white/60 hover:bg-white/12 focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:outline-none"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Slide surface */}
      <div className="flex flex-1 overflow-hidden bg-background">
        {/* Sidebar */}
        <div className="flex w-[240px] shrink-0 flex-col justify-between border-r border-border bg-card p-7 overflow-hidden">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
              {String(currentSlide + 1).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
            </div>
            <div className="mb-4 h-0.5 w-8 bg-primary" />
            <h2 className="font-heading text-xl font-black leading-tight text-foreground">
              {SLIDE_LABELS[currentSlide]}
            </h2>
          </div>
          <nav className="flex flex-col gap-2.5">
            {SLIDE_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => { goTo(i); setIsPlaying(false) }}
                className={cn(
                  "flex items-center gap-2.5 text-left transition-opacity",
                  i === currentSlide ? "opacity-100" : "opacity-35 hover:opacity-65",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full transition-all",
                    i === currentSlide ? "scale-125 bg-primary" : "bg-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px]",
                    i === currentSlide
                      ? "font-semibold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content area */}
        <div className="min-w-0 flex-1 overflow-hidden">
          {SLIDES[currentSlide]}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => { setCurrentSlide((c) => Math.max(0, c - 1)); setIsPlaying(false) }}
          disabled={currentSlide === 0}
          aria-label="Previous slide"
          className="flex h-10 w-10 items-center justify-center border border-white/20 bg-white/8 text-white/70 transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-25 focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="relative h-0.5 w-64 overflow-hidden bg-white/12">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / TOTAL) * 100}%` }}
          />
        </div>

        <span className="min-w-[44px] text-center text-[11px] tabular-nums text-white/35">
          {currentSlide + 1} / {TOTAL}
        </span>

        <button
          onClick={() => { setCurrentSlide((c) => Math.min(TOTAL - 1, c + 1)); setIsPlaying(false) }}
          disabled={currentSlide === TOTAL - 1}
          aria-label="Next slide"
          className="flex h-10 w-10 items-center justify-center border border-white/20 bg-white/8 text-white/70 transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-25 focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

    </div>,
    document.body,
  )
}
