export function adminHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  return headers
}
