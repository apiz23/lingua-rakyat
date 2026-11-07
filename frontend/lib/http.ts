// Single API transport. Every browser/server request to the FastAPI backend
// resolves its URL and authentication behavior here; do not add competing
// fetch wrappers.
//
// Rules:
// - Browser with NEXT_PUBLIC_API_URL unset uses same-origin ("/api/...").
// - Server-side requests require an absolute NEXT_PUBLIC_API_URL.
// - No localhost fallback exists anywhere.
// - A 401 is retried at most once, and only with a *different* fresh token.
//   If the refresh yields no token we never downgrade to anonymous.
// - 403 never refreshes a token. 429 raises a typed rate-limit error.
// - Sensitive responses are no-store. Streams are returned untouched.

import { authHeader } from "@/lib/auth-token"
import { API_URL } from "@/lib/config"

export class ApiTransportError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiTransportError"
    this.status = status
  }
}

export class ApiRateLimitError extends ApiTransportError {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super(
      `Too many requests — please wait ${retryAfterSeconds} seconds and try again.`,
      429
    )
    this.name = "ApiRateLimitError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

const ABSOLUTE_URL = /^https?:\/\//i

/**
 * Resolve an API path to a request URL.
 *
 * An empty path returns the configured base (used by existing endpoint
 * builders). Server-side callers get an explicit configuration error instead
 * of a relative URL that would be interpreted against the server origin.
 */
export function resolveApiUrl(path: string): string {
  if (ABSOLUTE_URL.test(path)) return path

  const normalized = path.startsWith("/") || path === "" ? path : `/${path}`

  if (API_URL) return `${API_URL}${normalized}`

  if (typeof window === "undefined") {
    throw new ApiTransportError(
      "NEXT_PUBLIC_API_URL must be an absolute URL for server-side API requests.",
      0
    )
  }

  return normalized || "/"
}

function rateLimitError(response: Response): ApiRateLimitError {
  const parsed = Number.parseInt(response.headers.get("Retry-After") ?? "60", 10)
  return new ApiRateLimitError(Number.isFinite(parsed) && parsed > 0 ? parsed : 60)
}

function withHeaders(init: RequestInit | undefined, extra: Record<string, string>) {
  const headers = new Headers(init?.headers)
  for (const [name, value] of Object.entries(extra)) {
    if (value) headers.set(name, value)
  }
  return headers
}

function requestInit(
  init: RequestInit | undefined,
  auth: Record<string, string>
): RequestInit {
  const headers = withHeaders(init, auth)
  // Never set Content-Type manually: the browser must add the multipart
  // boundary for FormData. JSON callers already pass their own header.
  return {
    ...init,
    headers,
    // Sensitive responses (answers, history, shares, PDFs) must not be cached.
    cache: init?.cache ?? "no-store",
  }
}

function throwIfRateLimited(response: Response): void {
  if (response.status === 429) throw rateLimitError(response)
}

function aborted(signal?: AbortSignal | null): boolean {
  return Boolean(signal?.aborted)
}

// On a hard page load the Clerk token getter is registered in an effect that
// can run after a page's own data effect. A 401 without a credential is
// therefore retried once after this short wait so a signed-in session is not
// misreported as anonymous. A genuinely anonymous request still stays denied.
const TOKEN_REGISTRATION_WAIT_MS = 250

function waitForTokenRegistration(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, TOKEN_REGISTRATION_WAIT_MS))
}

/**
 * Perform an authenticated request. The returned Response body is never
 * consumed, so callers may stream it.
 */
export async function authorizedFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = resolveApiUrl(path)
  const firstAuth = await authHeader()
  const firstToken = firstAuth.Authorization

  if (aborted(init?.signal)) {
    throw new DOMException("Request cancelled", "AbortError")
  }

  let response = await fetch(url, requestInit(init, firstAuth))
  throwIfRateLimited(response)

  if (response.status === 401) {
    // Only a request that carried a credential is retried with a refreshed
    // one. A first-paint request that raced token registration gets one short
    // wait, then retries only if a credential now exists.
    if (!firstToken) {
      await waitForTokenRegistration()
      if (aborted(init?.signal)) {
        throw new DOMException("Request cancelled", "AbortError")
      }
      const late = await authHeader()
      if (!late.Authorization) return response
      response = await fetch(url, requestInit(init, late))
      throwIfRateLimited(response)
      return response
    }
    if (aborted(init?.signal)) {
      throw new DOMException("Request cancelled", "AbortError")
    }
    const refreshed = await authHeader()
    const refreshedToken = refreshed.Authorization
    if (!refreshedToken || refreshedToken === firstToken) return response

    response = await fetch(url, requestInit(init, refreshed))
    throwIfRateLimited(response)
  }

  // 403 is an authorization decision, not an expiry signal: no retry here.
  return response
}

/** Anonymous request helper for genuinely public endpoints (e.g. shared answers). */
export async function publicFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = resolveApiUrl(path)
  if (aborted(init?.signal)) {
    throw new DOMException("Request cancelled", "AbortError")
  }
  const response = await fetch(url, requestInit(init, {}))
  throwIfRateLimited(response)
  return response
}
