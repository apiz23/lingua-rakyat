"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type AppLanguage = "ms" | "en"

interface LanguageContextValue {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  toggleLanguage: () => void
}

const STORAGE_KEY = "lingua-rakyat-language"

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [language, setLanguageState] = useState<AppLanguage>("ms")

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "ms" || saved === "en") {
      setLanguageState(saved)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language === "ms" ? "ms" : "en"
  }, [language])

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      toggleLanguage: () =>
        setLanguageState((prev) => (prev === "ms" ? "en" : "ms")),
    }),
    [language]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }

  return context
}
