import { afterEach, describe, expect, it, vi } from "vitest"

import { formatDateOnly, parseDateOnly } from "./date-only"

afterEach(() => vi.unstubAllEnvs())

describe("date-only form values", () => {
  it.each([
    "",
    "2026-2-09",
    "2026-02-30",
    "2026-13-01",
    "2026-11-09T00:00:00Z",
  ])("rejects an invalid date-only value: %s", (value) =>
    expect(parseDateOnly(value)).toBeUndefined()
  )

  it("keeps empty optional dates empty", () => {
    expect(parseDateOnly(undefined)).toBeUndefined()
    expect(formatDateOnly(new Date("invalid"))).toBe("")
  })

  it("accepts a valid leap day and rejects a non-leap day", () => {
    expect(formatDateOnly(parseDateOnly("2024-02-29")!)).toBe("2024-02-29")
    expect(parseDateOnly("2025-02-29")).toBeUndefined()
  })

  it("preserves a Malaysian calendar date instead of shifting it through UTC", () => {
    vi.stubEnv("TZ", "Asia/Kuala_Lumpur")
    const date = parseDateOnly("2026-11-09")!
    expect(date.getHours()).toBe(0)
    expect(date.toISOString()).toBe("2026-11-08T16:00:00.000Z")
    expect(formatDateOnly(date)).toBe("2026-11-09")
  })

  it("preserves the selected day in a negative UTC offset", () => {
    vi.stubEnv("TZ", "America/New_York")
    expect(formatDateOnly(parseDateOnly("2026-11-09")!)).toBe("2026-11-09")
  })
})
