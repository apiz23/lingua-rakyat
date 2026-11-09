import { describe, expect, it } from "vitest"

import { ADMIN_NAV } from "./admin-nav"

const PUBLIC_PATHS = new Set(["/", "/about", "/results"])
const CITIZEN_PATHS = new Set(["/workspace", "/profile", "/shares"])

describe("admin navigation isolation", () => {
  it("keeps every admin link inside /manage", () => {
    for (const item of ADMIN_NAV) {
      expect(item.href.startsWith("/manage")).toBe(true)
    }
  })

  it("never reuses a public or citizen route", () => {
    for (const item of ADMIN_NAV) {
      expect(PUBLIC_PATHS.has(item.href)).toBe(false)
      expect(CITIZEN_PATHS.has(item.href)).toBe(false)
    }
  })

  it("has unique destinations and covers the required sections", () => {
    const hrefs = ADMIN_NAV.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const expected of [
      "/manage",
      "/manage/documents",
      "/manage/ingestion",
      "/manage/sources",
      "/manage/review",
      "/manage/publications",
      "/manage/audit",
      "/manage/users",
      "/manage/status",
    ]) {
      expect(hrefs).toContain(expected)
    }
  })
})
