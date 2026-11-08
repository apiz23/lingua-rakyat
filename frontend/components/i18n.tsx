"use client"
import { useMemo } from "react"
import NextLink from "next/link"
import {
  usePathname as useNextPathname,
  useRouter as useNextRouter,
} from "next/navigation"
import { useLanguage } from "./language-provider"
import { localizeHref, stripLocale } from "@/lib/i18n/routing"
import { translator } from "@/lib/i18n/translate"
export function useTranslations() {
  const { language } = useLanguage()
  return useMemo(() => translator(language), [language])
}
/** Translate interface copy only. Never pass user or document content here. */
export function UiText({ text }: { text?: string }) {
  const t = useTranslations()
  return text ? t(text) : null
}
export function usePathname() {
  return stripLocale(useNextPathname())
}
export function useRouter() {
  const router = useNextRouter()
  const { language } = useLanguage()
  const locale = language === "ms" ? "ms" : "en"
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(localizeHref(href, locale), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(localizeHref(href, locale), options),
    }),
    [router, locale]
  )
}
export function LocalizedLink({
  href,
  ...props
}: React.ComponentProps<typeof NextLink>) {
  const { language } = useLanguage()
  const locale = language === "ms" ? "ms" : "en"
  const localized =
    typeof href === "string"
      ? localizeHref(href, locale)
      : {
          ...href,
          pathname: href.pathname
            ? localizeHref(href.pathname, locale)
            : href.pathname,
        }
  return <NextLink href={localized} {...props} />
}
