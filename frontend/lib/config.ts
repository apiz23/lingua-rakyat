// Single source of truth for the backend origin.
//
// Production builds inline NEXT_PUBLIC_API_URL. An empty value means
// same-origin, which is correct for a reverse-proxied deployment; it must
// never silently fall back to localhost in a production bundle.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "")
