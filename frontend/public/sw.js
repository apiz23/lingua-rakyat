// This worker deliberately stores no pages, responses, or user data.
const LEGACY_CACHE = "lingua-rakyat-offline-v1"
const PROTOCOL_VERSION = "phase0b-2"

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.delete(LEGACY_CACHE).then(async () => {
      await self.clients.claim()
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of clients) client.postMessage({ type: "LR_OFFLINE_INVALIDATE", version: PROTOCOL_VERSION })
    })
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type !== "LR_OFFLINE_CHECK" || !event.ports?.[0]) return
  event.waitUntil(caches.has(LEGACY_CACHE).then((exists) => {
    event.ports[0].postMessage({ type: "LR_OFFLINE_STATUS", version: PROTOCOL_VERSION, clean: !exists })
  }).catch(() => {
    event.ports[0].postMessage({ type: "LR_OFFLINE_STATUS", version: PROTOCOL_VERSION, clean: false })
  }))
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET" || request.mode !== "navigate") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request).catch(() => new Response(
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Offline</title></head><body><main><h1>You're offline</h1><p>Documents and saved answers are unavailable offline. Reconnect to continue.</p></main></body></html>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    ))
  )
})
