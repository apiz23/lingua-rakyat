import "server-only"
import { headers } from "next/headers"
import { isLocale } from "./routing"
import { translator } from "./translate"
export async function getLocale() {
  const locale = (await headers()).get("x-lingua-locale")
  return isLocale(locale) ? locale : "en"
}
export async function getTranslations() {
  return translator(await getLocale())
}
