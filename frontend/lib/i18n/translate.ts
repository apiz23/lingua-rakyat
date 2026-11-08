import ms from "./ms.json"
import en from "./en.json"
import type { Locale } from "./routing"
export const messages: Readonly<Record<string, string>> = ms
export function translator(locale: Locale | "zh") {
  const translate = (
    message: string,
    values?: Record<string, string | number | boolean | null | undefined>
  ): string => {
    const normalized = message.replace(/\s+/g, " ").trim()
    if (normalized.startsWith("Document is not publishable: ") && !values) {
      return translate("Document is not publishable: {reasons}", {
        reasons: normalized
          .slice("Document is not publishable: ".length)
          .split(", ")
          .map((code) => translate(code.replaceAll("_", " ")))
          .join(", "),
      })
    }
    let result =
      locale === "ms"
        ? (messages[normalized] ?? message)
        : ((en as Record<string, string>)[normalized] ?? message)
    if (values)
      result = result.replace(/\{(\w+)\}/g, (match, key: string) =>
        String(values[key] ?? match)
      )
    return result
  }
  return Object.assign(translate, {
    locale: locale === "ms" ? "ms-MY" : locale === "zh" ? "zh-CN" : "en-MY",
  })
}
