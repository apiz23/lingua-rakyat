import { describe, expect, it } from "vitest"
import {
  authReturnPath,
  localizeHref,
  pathLocale,
  stripLocale,
} from "./i18n/routing"
import { translator } from "./i18n/translate"
import en from "./i18n/en.json"
import ms from "./i18n/ms.json"
import { GET } from "@/app/api/i18n/[locale]/route"

describe("locale routing", () => {
  it.each([
    "/",
    "/about",
    "/results",
    "/share/a",
    "/sign-in",
    "/sign-up",
    "/sso-callback",
    "/workspace",
    "/profile",
    "/shares",
    "/manage",
    "/manage/documents",
    "/manage/documents/id",
    "/manage/ingestion",
    "/manage/sources",
    "/manage/review",
    "/manage/publications",
    "/manage/audit",
    "/manage/users",
    "/manage/status",
    "/eval",
    "/benchmark",
  ])("supports both locales for %s", (path) => {
    for (const locale of ["en", "ms"] as const) {
      const localized = localizeHref(path, locale)
      expect(pathLocale(localized)).toBe(locale)
      expect(stripLocale(localized)).toBe(path)
      expect(localizeHref(localized, locale)).toBe(localized)
    }
  })
  it("preserves search and fragment when switching locales", () => {
    expect(
      localizeHref("/en/manage/documents?source=one#revisions", "ms")
    ).toBe("/ms/manage/documents?source=one#revisions")
    expect(localizeHref("/en?query=one#two", "ms")).toBe("/ms?query=one#two")
  })
  it.each([
    "/api/v1/admin/documents",
    "/__clerk/v1/client",
    "/_next/static/a.js",
    "/document.pdf",
    "//example.com",
    "https://example.com",
    "#section",
    "mailto:example@example.com",
  ])("preserves endpoint or external URL %s", (href) => {
    expect(localizeHref(href, "ms")).toBe(href)
  })
  it("validates authentication return URLs", () => {
    expect(authReturnPath("/manage/documents/id", "ms")).toBe(
      "/ms/manage/documents/id"
    )
    expect(authReturnPath("/en/shares", "ms")).toBe("/ms/shares")
    for (const url of [
      "https://evil.test",
      "//evil.test",
      "/manage\\evil.test",
      "/management",
      null,
    ])
      expect(authReturnPath(url, "ms")).toBe("/ms/workspace")
  })
})
describe("translation catalogs", () => {
  it("has matching nonempty messages and placeholders", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ms).sort())
    for (const [key, value] of Object.entries(ms)) {
      if (key && key !== "&nbsp;") expect(value.trim(), key).not.toBe("")
      const tokens = (s: string) =>
        [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      expect(tokens(value), key).toEqual(tokens(key))
    }
  })
  it("translates UI copy, codes, and dynamic messages", () => {
    const t = translator("ms")
    expect(t("Sign in")).toBe("Log masuk")
    expect(t("Results")).toBe("Keputusan")
    expect(t("Benchmarks")).toBe("Penanda aras")
    expect(t("Approve revision {value0}", { value0: 3 })).toBe(
      "Luluskan semakan 3"
    )
    expect(t("published")).toBe("Diterbitkan")
    expect(
      t("Document is not publishable: missing_source, missing_approval")
    ).toBe("Dokumen tidak boleh diterbitkan: Sumber tiada, Kelulusan tiada")
    expect(translator("en")("published")).toBe("Published")
  })
  it("preserves unknown content and inserted values", () => {
    expect(translator("ms")("Unknown document name")).toBe(
      "Unknown document name"
    )
    expect(
      translator("ms")("Processing {name}…", {
        name: "<script>{count}</script>",
      })
    ).toBe("Sedang memproses <script>{count}</script>…")
  })
  it("serves catalogs and rejects unsupported locales", async () => {
    for (const locale of ["en", "ms"]) {
      const response = await GET(
        new Request(`https://example.com/api/i18n/${locale}`),
        { params: Promise.resolve({ locale }) }
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Language")).toBe(locale)
      expect((await response.json()).locale).toBe(locale)
    }
    expect(
      (
        await GET(new Request("https://example.com/api/i18n/fr"), {
          params: Promise.resolve({ locale: "fr" }),
        })
      ).status
    ).toBe(404)
  })
})
