import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type HttpModule = typeof import("@/lib/http")
type AuthModule = typeof import("@/lib/auth-token")

async function loadHttp(options: { apiUrl?: string; browser?: boolean }) {
  vi.resetModules()
  if (options.apiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = options.apiUrl
  if (options.browser) {
    ;(globalThis as { window?: unknown }).window = {}
  } else {
    delete (globalThis as { window?: unknown }).window
  }
  const http = (await import("@/lib/http")) as HttpModule
  const auth = (await import("@/lib/auth-token")) as AuthModule
  return { http, auth }
}

function jsonResponse(status: number, body = "ok", headers: Record<string, string> = {}) {
  return new Response(body, { status, headers })
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  delete (globalThis as { window?: unknown }).window
  vi.restoreAllMocks()
})

describe("resolveApiUrl", () => {
  it("rejects relative server-side requests without an absolute API URL", async () => {
    const { http } = await loadHttp({ apiUrl: undefined, browser: false })
    expect(() => http.resolveApiUrl("/api/chat")).toThrow(http.ApiTransportError)
  })

  it("uses same-origin in the browser when no API URL is configured", async () => {
    const { http } = await loadHttp({ apiUrl: undefined, browser: true })
    expect(http.resolveApiUrl("/api/chat")).toBe("/api/chat")
    expect(http.resolveApiUrl("api/chat")).toBe("/api/chat")
  })

  it("uses the configured absolute origin", async () => {
    const { http } = await loadHttp({ apiUrl: "https://api.example.com/", browser: true })
    expect(http.resolveApiUrl("/api/chat")).toBe("https://api.example.com/api/chat")
  })

  it("never falls back to localhost", async () => {
    const { http } = await loadHttp({ apiUrl: undefined, browser: true })
    expect(http.resolveApiUrl("/api/chat")).not.toContain("localhost")
  })
})

describe("authorizedFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("injects the bearer token and no-store caching", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    auth.setAuthTokenGetter(async () => "token-1")
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200))
    globalThis.fetch = fetchMock

    await http.authorizedFetch("/api/chat")

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1")
    expect(init.cache).toBe("no-store")
  })

  it("retries a 401 once with a different refreshed token", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    const tokens = ["token-1", "token-2"]
    auth.setAuthTokenGetter(async () => tokens.shift() ?? null)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200))
    globalThis.fetch = fetchMock

    const response = await http.authorizedFetch("/api/me")

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const second = fetchMock.mock.calls[1][1] as RequestInit
    expect(new Headers(second.headers).get("Authorization")).toBe("Bearer token-2")
  })

  it("never downgrades to anonymous when the refresh yields no token", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    const tokens: Array<string | null> = ["token-1", null]
    auth.setAuthTokenGetter(async () => tokens.shift() ?? null)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401))
    globalThis.fetch = fetchMock

    const response = await http.authorizedFetch("/api/me")

    expect(response.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not retry an anonymous 401", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    auth.setAuthTokenGetter(async () => null)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401))
    globalThis.fetch = fetchMock

    await http.authorizedFetch("/api/chat")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("retries once when token registration lands after the first request", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    const tokens: Array<string | null> = [null, "token-late"]
    auth.setAuthTokenGetter(async () => tokens.shift() ?? null)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200))
    globalThis.fetch = fetchMock

    const response = await http.authorizedFetch("/api/v1/admin/dashboard")

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const second = fetchMock.mock.calls[1][1] as RequestInit
    expect(new Headers(second.headers).get("Authorization")).toBe("Bearer token-late")
  })

  it("does not refresh on 403", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    const getter = vi.fn(async () => "token-1")
    auth.setAuthTokenGetter(getter)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403))
    globalThis.fetch = fetchMock

    const response = await http.authorizedFetch("/api/admin")

    expect(response.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getter).toHaveBeenCalledTimes(1)
  })

  it("surfaces 429 with Retry-After", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    auth.setAuthTokenGetter(async () => null)
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, "", { "Retry-After": "7" }))

    await expect(http.authorizedFetch("/api/chat")).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 7,
    })
  })

  it("never sets Content-Type for FormData", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    auth.setAuthTokenGetter(async () => null)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200))
    globalThis.fetch = fetchMock

    await http.authorizedFetch("/api/documents/upload", {
      method: "POST",
      body: new FormData(),
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).has("Content-Type")).toBe(false)
  })

  it("returns the response without consuming a stream", async () => {
    const { http, auth } = await loadHttp({ apiUrl: "", browser: true })
    auth.setAuthTokenGetter(async () => "token-1")
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {}\n\n"))
        controller.close()
      },
    })
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }))

    const response = await http.authorizedFetch("/api/chat/ask-stream", { method: "POST" })

    expect(response.bodyUsed).toBe(false)
  })

  it("honours an already-aborted signal before fetching", async () => {
    const { http } = await loadHttp({ apiUrl: "", browser: true })
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    const controller = new AbortController()
    controller.abort()

    await expect(
      http.authorizedFetch("/api/chat", { signal: controller.signal })
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
