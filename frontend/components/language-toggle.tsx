"use client"

import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/language-provider"

export default function LanguageToggle({
  className,
}: {
  className?: string
}) {
  const { language, setLanguage } = useLanguage()

  return (
    <div
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
      >
        BM
      </Button>
      <Button
        type="button"
        size="sm"
        variant={language === "en" ? "default" : "ghost"}
        className="h-8 px-3 text-xs"
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
    </div>
  )
}
