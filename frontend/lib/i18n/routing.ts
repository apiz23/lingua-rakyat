export const locales = ["en", "ms"] as const
export type Locale = (typeof locales)[number]
export const LOCALE_COOKIE = "lingua-rakyat-locale"
export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ms"
}
export function pathLocale(path: string): Locale | undefined {
  const segment = /^\/([^/?#]+)/.exec(path)?.[1]
  return isLocale(segment) ? segment : undefined
}
export function stripLocale(path: string): string {
  return pathLocale(path)
    ? path.replace(/^\/(en|ms)(?=\/|\?|#|$)/, "") || "/"
    : path
}
export function localizeHref(href: string, locale: Locale): string {
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    /^\/(api|_next|__clerk)(\/|$)/.test(href) ||
    /\.[a-z0-9]+(?:[?#]|$)/i.test(href)
  )
    return href
  const bare = stripLocale(href)
  return `/${locale}${bare === "/" ? "" : bare}`
}
export function authReturnPath(value: string | null, locale: Locale): string {
  const bare = value ? stripLocale(value) : ""
  return /^\/(manage|workspace|profile|shares)(\/|\?|#|$)/.test(bare) &&
    !bare.includes("\\")
    ? localizeHref(bare, locale)
    : localizeHref("/workspace", locale)
}
