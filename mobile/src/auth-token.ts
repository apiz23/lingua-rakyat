// Bridge between Clerk's React-context getToken() and plain fetch helpers —
// same pattern as the web app's frontend/lib/auth-token.ts.

type TokenGetter = () => Promise<string | null>

let tokenGetter: TokenGetter | null = null

export function setAuthTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn
}

/** Clear the token getter — called when the backend rejects the token (401)
 *  so future requests fall back to anonymous mode. */
export function clearAuthToken() {
  tokenGetter = null
}

export async function authHeader(): Promise<Record<string, string>> {
  if (!tokenGetter) return {}
  try {
    const token = await tokenGetter()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {} // never let auth plumbing break an anonymous request
  }
}
