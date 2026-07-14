"use client"

import type { LucideIcon } from "lucide-react"
import { FileQuestion, Landmark, Sparkles, Upload } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import { Document } from "@/lib/api"
import {
  AGENCY_QUESTION_MAP,
  GENERIC_ASK_CHIP,
  GENERIC_DOC_QUESTION,
  Lang,
} from "@/lib/agency-questions"

interface EmptyStateProps {
  onChipClick: (question: string) => void
  readyDocs: Document[]
  docsLoading: boolean
}

interface Chip {
  icon: LucideIcon
  question: string
}

const GREETING: Record<Lang, { title: string; sub: string; hint: string }> = {
  ms: {
    title: "Selamat datang",
    sub: "Tanya tentang dokumen kerajaan anda",
    hint: "Tekan satu soalan di bawah, atau taip soalan anda sendiri",
  },
  en: {
    title: "Welcome",
    sub: "Ask about your government documents",
    hint: "Tap a question below, or type your own",
  },
  zh: {
    title: "欢迎使用",
    sub: "查询您的政府文件",
    hint: "点击下方问题，或输入您自己的问题",
  },
}

const EMPTY_LIBRARY: Record<Lang, { title: string; sub: string }> = {
  ms: {
    title: "Belum ada dokumen sedia",
    sub: "Muat naik PDF pertama anda untuk mula bertanya",
  },
  en: {
    title: "No documents ready yet",
    sub: "Upload your first PDF to start asking questions",
  },
  zh: {
    title: "尚无可用文件",
    sub: "上传您的第一份PDF即可开始提问",
  },
}

function buildChips(readyDocs: Document[], lang: Lang): Chip[] {
  const chips: Chip[] = []
  const seenAgencies = new Set<string>()

  for (const doc of readyDocs) {
    if (chips.length >= 4) break
    if (!doc.agency || seenAgencies.has(doc.agency)) continue
    const questions = AGENCY_QUESTION_MAP[doc.agency]?.[lang]
    if (!questions || questions.length === 0) continue
    seenAgencies.add(doc.agency)
    chips.push({ icon: Landmark, question: questions[0] })
  }

  const nonFeatured = readyDocs.filter((d) => !d.is_featured)
  if (chips.length < 4 && nonFeatured.length > 0 && nonFeatured.length <= 2) {
    for (const doc of nonFeatured) {
      if (chips.length >= 4) break
      chips.push({
        icon: FileQuestion,
        question: GENERIC_DOC_QUESTION[lang](doc.name),
      })
    }
  }

  if (chips.length < 4) {
    chips.push({ icon: Sparkles, question: GENERIC_ASK_CHIP[lang] })
  }

  return chips
}

export function EmptyState({ onChipClick, readyDocs, docsLoading }: EmptyStateProps) {
  const { language } = useLanguage()
  const lang: Lang = language === "zh" ? "zh" : language === "en" ? "en" : "ms"
  const greeting = GREETING[lang]

  if (docsLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[62px] animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    )
  }

  if (readyDocs.length === 0) {
    const empty = EMPTY_LIBRARY[lang]
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Upload className="h-5 w-5" />
        </span>
        <h1 className="mb-1 font-display text-2xl font-bold tracking-tight text-foreground">
          {empty.title}
        </h1>
        <p className="text-sm text-muted-foreground">{empty.sub}</p>
      </div>
    )
  }

  const chips = buildChips(readyDocs, lang)

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="mb-1 font-display text-3xl font-bold tracking-tight text-foreground">
        {greeting.title}
      </h1>
      <p className="mb-2 text-muted-foreground">{greeting.sub}</p>
      <p className="mb-8 text-sm text-muted-foreground/70">{greeting.hint}</p>

      <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {chips.map(({ icon: Icon, question }) => (
          <button
            key={question}
            onClick={() => onChipClick(question)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition hover:border-primary/40 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="text-sm leading-snug text-foreground">
              {question}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
