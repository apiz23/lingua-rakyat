import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const originalFetch = globalThis.fetch

async function loadAdminApi() {
  vi.resetModules()
  process.env.NEXT_PUBLIC_API_URL = "https://api.example.test"
  return import("@/lib/admin-api")
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("admin API transport states", () => {
  beforeEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("returns parsed data on success", async () => {
    const api = await loadAdminApi()
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { items: [], total: 0, page: 1, page_size: 25 }))
    const result = await api.listAdminDocuments()
    expect(result.total).toBe(0)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/admin/documents?",
      expect.any(Object)
    )
  })

  it("maps 401 to unauthorized", async () => {
    const api = await loadAdminApi()
    globalThis.fetch = vi.fn().mockResolvedValue(json(401, {}))
    await expect(api.getDashboard()).rejects.toMatchObject({ status: 401, code: "unauthorized" })
  })

  it("maps 403 to forbidden without retry", async () => {
    const api = await loadAdminApi()
    const fetchMock = vi.fn().mockResolvedValue(json(403, {}))
    globalThis.fetch = fetchMock
    await expect(api.getDashboard()).rejects.toMatchObject({ status: 403, code: "forbidden" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("maps 503 to unavailable", async () => {
    const api = await loadAdminApi()
    globalThis.fetch = vi.fn().mockResolvedValue(json(503, {}))
    await expect(api.getDashboard()).rejects.toMatchObject({ status: 503, code: "unavailable" })
  })

  it("surfaces backend validation detail", async () => {
    const api = await loadAdminApi()
    globalThis.fetch = vi.fn().mockResolvedValue(json(400, { detail: "A reason is required" }))
    await expect(api.publishAdminDocument("doc-1")).rejects.toMatchObject({
      status: 400,
      code: "error",
      message: "A reason is required",
    })
  })

  it("does not set JSON Content-Type for uploads", async () => {
    const api = await loadAdminApi()
    const fetchMock = vi.fn().mockResolvedValue(json(200, { id: "d1", name: "a.pdf", status: "processing" }))
    globalThis.fetch = fetchMock
    await api.uploadAdminDocument(new File(["%PDF-"], "a.pdf", { type: "application/pdf" }))
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.has("Content-Type")).toBe(false)
    expect(init.body).toBeInstanceOf(FormData)
  })

  it("starts discovery with a privileged POST", async () => {
    const api = await loadAdminApi()
    const fetchMock = vi.fn().mockResolvedValue(json(200, { id: "job-1", status: "queued" }))
    globalThis.fetch = fetchMock

    await api.startAdminDiscovery("src-1")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/admin/ingestion/sources/src-1/discover",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("does not auto-retry mutation calls on 503", async () => {
    const api = await loadAdminApi()
    const fetchMock = vi.fn().mockResolvedValue(json(503, { detail: "Ingestion unavailable" }))
    globalThis.fetch = fetchMock

    await expect(api.ingestCandidate("cand-1")).rejects.toMatchObject({
      status: 503,
      code: "unavailable",
      message: "Ingestion unavailable",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("promotes an exact revision through the privileged endpoint", async () => {
    const api = await loadAdminApi()
    const fetchMock = vi.fn().mockResolvedValue(json(200, { revision: 2, is_current: true }))
    globalThis.fetch = fetchMock

    await api.promoteAdminRevision("doc-1", 2, "Validated")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/admin/documents/doc-1/revisions/2/promote",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Validated" }),
      })
    )
  })

  it("sends revision review decisions with reason", async () => {
    const api = await loadAdminApi()
    const fetchMock = vi.fn().mockResolvedValue(json(200, { revision: 2 }))
    globalThis.fetch = fetchMock

    await api.reviewAdminRevision("doc-1", 2, "rollback" as never, "ignored")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/admin/documents/doc-1/revisions/2/review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "rollback", reason: "ignored" }),
      })
    )
  })
})
