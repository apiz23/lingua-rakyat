
type TokenGetter = () => Promise<string | null>

let tokenGetter: TokenGetter | null = null

export function setAuthTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn
}

/** Returns the current Clerk bearer header, or an empty object when the app
 *  has no session. A rejected token must surface as reauthentication — never
 *  as a silent downgrade to anonymous access. */
export async function authHeader(): Promise<Record<string, string>> {
  if (!tokenGetter) return {}
  try {
    const token = await tokenGetter()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}
