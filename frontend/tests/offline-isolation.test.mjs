import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"

test("legacy offline data is purged and never returned or rewritten", async () => {
  const data = new Map([
    ["lr-offline-history:v1", "private history"],
    ["lr-offline-sources:v1", "private excerpt"],
    ["lr-offline-documents:v1", "old catalogue"],
    ["unrelated", "keep"],
  ])
  globalThis.window = { localStorage: { removeItem: (key) => data.delete(key) } }
  try {
    const cache = await import("../lib/offline-cache.ts")
    cache.purgeLegacyOfflineData()
    cache.cacheHistory([{ id: "private" }])
    cache.cacheDocuments([{ id: "private" }])
    cache.cacheAnswerSources({ sources: [{ text: "private" }] })
    assert.deepEqual(cache.getCachedHistory(), [])
    assert.deepEqual(cache.getCachedDocuments(), [])
    assert.deepEqual([...data.keys()], ["unrelated"])
    globalThis.window.localStorage.removeItem = () => { throw new Error("blocked") }
    assert.equal(cache.purgeLegacyOfflineData().ok, false)
    assert.deepEqual(cache.getCachedHistory(), [])
  } finally {
    delete globalThis.window
  }
})

test("cleanup attempts each key independently after a partial failure", async () => {
  const attempted = []
  globalThis.window = { localStorage: { removeItem: (key) => {
    attempted.push(key)
    if (key.includes("history")) throw new Error("blocked")
  } } }
  try {
    const cache = await import("../lib/offline-cache.ts")
    assert.deepEqual(cache.purgeLegacyOfflineData(), { ok: false, failed: ["history"] })
    assert.equal(attempted.length, 3)
    globalThis.window.localStorage.removeItem = () => {}
    assert.deepEqual(cache.purgeLegacyOfflineData(), { ok: true, failed: [] })
  } finally { delete globalThis.window }
})

test("worker deletes only its legacy cache and never serves cached navigation", async () => {
  const handlers = new Map()
  const deleted = []
  let claimed = false
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  const context = {
    self: {
      location: { origin: "https://example.test" },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => { claimed = true }, matchAll: async () => [] },
    },
    caches: { delete: async (name) => { deleted.push(name); return true } },
    fetch: async () => { throw new Error("offline") },
    URL,
    Response,
  }
  vm.runInNewContext(source, context)
  let activation
  handlers.get("activate")({ waitUntil: (promise) => { activation = promise } })
  await activation
  assert.deepEqual(deleted, ["lingua-rakyat-offline-v1"])
  assert.equal(claimed, true)
  let response
  handlers.get("fetch")({
    request: { method: "GET", mode: "navigate", url: "https://example.test/account" },
    respondWith: (promise) => { response = promise },
  })
  const result = await response
  assert.equal(result.status, 503)
  assert.equal(result.headers.get("cache-control"), "no-store")
  assert.match(await result.text(), /unavailable offline/)
})

test("worker does not claim clients if legacy cache deletion fails", async () => {
  const handlers = new Map()
  let claimed = false
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  vm.runInNewContext(source, {
    self: { addEventListener: (name, handler) => handlers.set(name, handler), clients: { claim: async () => { claimed = true } } },
    caches: { delete: async () => { throw new Error("blocked") } },
  })
  let activation
  handlers.get("activate")({ waitUntil: (promise) => { activation = promise } })
  await assert.rejects(activation, /blocked/)
  assert.equal(claimed, false)
})

test("worker challenge reports version and fails closed when cache check fails", async () => {
  const handlers = new Map()
  let fail = false
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  vm.runInNewContext(source, {
    self: { addEventListener: (name, handler) => handlers.set(name, handler) },
    caches: { has: async () => { if (fail) throw new Error("blocked"); return false } },
  })
  let result
  let pending
  const message = () => handlers.get("message")({ data: { type: "LR_OFFLINE_CHECK" }, ports: [{ postMessage: (value) => { result = value } }], waitUntil: (promise) => { pending = promise } })
  message()
  await pending
  assert.equal(result.version, "phase0b-2")
  assert.equal(result.clean, true)
  fail = true
  message()
  await pending
  assert.equal(result.clean, false)
})
