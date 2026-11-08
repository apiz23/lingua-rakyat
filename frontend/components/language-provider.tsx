"use client"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  LOCALE_COOKIE,
  localizeHref,
  pathLocale,
  type Locale,
} from "@/lib/i18n/routing"
type AppLanguage = Locale | "zh"
interface LanguageContextValue {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  toggleLanguage: () => void
}
const LanguageContext = createContext<LanguageContextValue | null>(null)
export function LanguageProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [legacyLanguage, setLegacyLanguage] =
    useState<AppLanguage>(initialLocale)
  const language = pathLocale(pathname) ?? legacyLanguage
  useEffect(() => {
    document.documentElement.lang = language
    window.localStorage.setItem("lingua-rakyat-language", language)
  }, [language])
  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (next: AppLanguage) => {
      setLegacyLanguage(next)
      if (next === "zh") return
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
      router.replace(
        localizeHref(window.location.pathname, next) +
          window.location.search +
          window.location.hash,
        { scroll: false }
      )
      router.refresh()
    }
    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "ms" ? "en" : "ms"),
    }
  }, [language, router])
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value)
    throw new Error("useLanguage must be used within LanguageProvider")
  return value
}
