"use client"

import type { LucideIcon } from "lucide-react"
import {
  CalendarClock,
  CreditCard,
  KeyRound,
  Plane,
  Users,
} from "lucide-react"
import { useLanguage } from "@/components/language-provider"

interface EmptyStateProps {
  onChipClick: (question: string) => void
}

interface TaskChip {
  icon: LucideIcon
  question: string
}

const CHIPS: Record<string, TaskChip[]> = {
  ms: [
    { icon: Plane, question: "Berapa yuran tukar pasport?" },
    { icon: KeyRound, question: "Cara reset kata laluan i-Akaun KWSP" },
    { icon: Users, question: "Apakah pelepasan cukai untuk ibu bapa?" },
    { icon: CreditCard, question: "Dokumen perlu untuk renew MyKad" },
    { icon: CalendarClock, question: "Bila tarikh akhir e-Filing LHDN?" },
  ],
  en: [
    { icon: Plane, question: "How much does passport renewal cost?" },
    { icon: KeyRound, question: "How to reset KWSP i-Akaun password?" },
    { icon: Users, question: "What tax relief applies to parents?" },
    { icon: CreditCard, question: "Documents needed to renew MyKad" },
    { icon: CalendarClock, question: "What is the LHDN e-Filing deadline?" },
  ],
  zh: [
    { icon: Plane, question: "护照续期费用是多少？" },
    { icon: KeyRound, question: "如何重置公积金 i-Akaun 密码？" },
    { icon: Users, question: "父母相关的税务减免有哪些？" },
    { icon: CreditCard, question: "更新身份证需要哪些文件？" },
    { icon: CalendarClock, question: "LHDN 报税截止日期是什么时候？" },
  ],
}

const GREETING: Record<string, { title: string; sub: string; hint: string }> = {
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

export function EmptyState({ onChipClick }: EmptyStateProps) {
  const { language } = useLanguage()
  const lang = (language as string) === "zh" ? "zh" : language
  const chips = CHIPS[lang] ?? CHIPS.ms
  const greeting = GREETING[lang] ?? GREETING.ms

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
