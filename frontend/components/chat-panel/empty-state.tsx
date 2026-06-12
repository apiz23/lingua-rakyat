"use client"

import { useLanguage } from "@/components/language-provider"

interface EmptyStateProps {
  onChipClick: (question: string) => void
}

const CHIPS: Record<string, string[]> = {
  ms: [
    "Berapa yuran tukar pasport?",
    "Cara reset kata laluan i-Akaun KWSP",
    "Apakah pelepasan cukai untuk ibu bapa?",
    "Dokumen perlu untuk renew MyKad",
    "Bila tarikh akhir e-Filing LHDN?",
  ],
  en: [
    "How much does passport renewal cost?",
    "How to reset KWSP i-Akaun password?",
    "What tax relief applies to parents?",
    "Documents needed to renew MyKad",
    "What is the LHDN e-Filing deadline?",
  ],
  zh: [
    "护照续期费用是多少？",
    "如何重置公积金 i-Akaun 密码？",
    "父母相关的税务减免有哪些？",
    "更新身份证需要哪些文件？",
    "LHDN 报税截止日期是什么时候？",
  ],
}

const GREETING: Record<string, { title: string; sub: string }> = {
  ms: { title: "Selamat datang", sub: "Tanya tentang dokumen kerajaan anda" },
  en: { title: "Welcome", sub: "Ask about your government documents" },
  zh: { title: "欢迎使用", sub: "查询您的政府文件" },
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
      <p className="mb-8 text-muted-foreground">{greeting.sub}</p>

      <div className="flex max-w-lg flex-wrap justify-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm transition hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
