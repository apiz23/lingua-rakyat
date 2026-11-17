
type TokenGetter = () => Promise<string | null>

export type AuthHeaders = {
  headers: Record<string, string>
  expired: boolean
}

let tokenGetter: TokenGetter | null = null

export function setAuthTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn
}

/** Returns the current Clerk bearer header. A rejected token reports
 *  `expired: true` so callers surface reauthentication instead of silently
 *  downgrading to anonymous access. */
export async function authHeader(): Promise<AuthHeaders> {
  if (!tokenGetter) return { headers: {}, expired: false }
  try {
    const token = await tokenGetter()
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      expired: false,
    }
  } catch {
    return { headers: {}, expired: true }
  }
}
