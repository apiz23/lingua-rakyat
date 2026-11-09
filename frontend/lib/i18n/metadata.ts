import "server-only"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { getLocale } from "./server"
import { translator } from "./translate"
import { localizeHref } from "./routing"

export async function localizeMetadata(metadata: Metadata): Promise<Metadata> {
  const locale = await getLocale()
  const t = translator(locale)
  const visit = (value: unknown, key = ""): unknown => {
    if (typeof value === "string")
      return ["title", "description", "default"].includes(key)
        ? t(value)
        : value
    if (Array.isArray(value)) return value.map((item) => visit(item))
    if (
      value &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype
    )
      return Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, visit(child, name)])
      )
    return value
  }
  const localized = visit(metadata) as Metadata
  const pathname = (await headers()).get("x-lingua-path") ?? "/"
  return {
    ...localized,
    alternates: {
      ...localized.alternates,
      canonical: localizeHref(pathname, locale),
      languages: {
        en: localizeHref(pathname, "en"),
        ms: localizeHref(pathname, "ms"),
        "x-default": localizeHref(pathname, "en"),
      },
    },
    ...(metadata.openGraph
      ? {
          openGraph: {
            ...localized.openGraph,
            locale: locale === "ms" ? "ms_MY" : "en_MY",
            alternateLocale: locale === "ms" ? ["en_MY"] : ["ms_MY"],
          },
        }
      : {}),
  }
}
