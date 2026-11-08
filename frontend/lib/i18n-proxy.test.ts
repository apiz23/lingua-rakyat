import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: (auth: unknown, request: NextRequest) => Response) =>
    (request: NextRequest) =>
      handler({}, request),
}))
import proxy from "../proxy"

const invoke = proxy as unknown as (request: NextRequest) => Response
describe("locale proxy", () => {
  it("preserves the origin and query on localized rewrites", () => {
    const request = new NextRequest("https://example.com/ms/about?mode=test")
    const response = invoke(request)
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/about?mode=test"
    )
    expect(response.headers.get("x-middleware-request-x-lingua-locale")).toBe(
      "ms"
    )
    expect(response.headers.get("Content-Language")).toBe("ms")
  })
  it("gives the URL precedence over the saved preference", () => {
    const response = invoke(
      new NextRequest("https://example.com/en/about", {
        headers: { cookie: "lingua-rakyat-locale=ms" },
      })
    )
    expect(response.headers.get("Content-Language")).toBe("en")
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/about"
    )
  })
  it("uses the saved preference on legacy URLs", () => {
    const response = invoke(
      new NextRequest("https://example.com/about", {
        headers: { cookie: "lingua-rakyat-locale=ms" },
      })
    )
    expect(response.headers.get("Content-Language")).toBe("ms")
    expect(response.headers.get("x-middleware-rewrite")).toBeNull()
  })
  it.each([
    "/api/v1/admin/documents",
    "/__clerk/v1/client",
    "/_next/static/a.js",
    "/document.pdf",
  ])("preserves machine endpoint %s", (path) => {
    const response = invoke(new NextRequest(`https://example.com${path}`))
    expect(response.headers.get("x-middleware-rewrite")).toBeNull()
    expect(
      response.headers.get("x-middleware-request-x-lingua-locale")
    ).toBeNull()
  })
})
