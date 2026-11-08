"use client"

import { useTranslations } from "@/components/i18n"
import { UiText } from "@/components/i18n"
import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/language-provider"

export default function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations()

  const { language, setLanguage } = useLanguage()

  return (
    <div
      role="group"
      aria-label={t("Language / Bahasa")}
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-background/70 p-1",
        className
      )}
    >
      <div className="flex items-center gap-1 px-2 text-muted-foreground">
        <Languages className="h-4 w-4" />
      </div>
      <Button
        type="button"
        size="sm"
        variant={language === "ms" ? "default" : "ghost"}
        className="h-8 px-3 text-xs"
        onClick={() => setLanguage("ms")}
        aria-label={t("Bahasa Melayu")}
        aria-pressed={language === "ms"}
        lang="ms"
      >
        {" "}
        <UiText text="BM" />{" "}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={language === "en" ? "default" : "ghost"}
        className="h-8 px-3 text-xs"
        onClick={() => setLanguage("en")}
        aria-label={t("English")}
        aria-pressed={language === "en"}
        lang="en"
      >
        {" "}
        <UiText text="EN" />{" "}
      </Button>
    </div>
  )
}
