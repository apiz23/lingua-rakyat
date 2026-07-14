const CACHE_NAME = "lingua-rakyat-offline-v1"
const APP_SHELL = ["/", "/workspace", "/icons/android-chrome-512x512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function safeCachePut(request, response) {
  // Cache API only supports http(s) requests — chrome-extension:, data:, etc.
  // throw synchronously and would otherwise become an unhandled rejection.
  if (!request.url.startsWith("http")) return
  caches.open(CACHE_NAME).then((cache) => cache.put(request, response))
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // Only this app's own pages/assets are ours to cache — never intercept
  // third-party requests (analytics beacons, extensions, OAuth providers).
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          safeCachePut(request, response.clone())
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const fallback = await caches.match("/workspace")
          return fallback || (await caches.match("/")) || Response.error()
        })
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) return response
          safeCachePut(request, response.clone())
          return response
        })
        .catch(() => cached || Response.error())
    })
  )
})
