// Bridge between Clerk's React-context getToken() and plain fetch helpers.
type TokenGetter = () => Promise<string | null>

let tokenGetter: TokenGetter | null = null

export function setAuthTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn
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
