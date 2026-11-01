import test from "node:test"
import assert from "node:assert/strict"
import { confirmOfflineController, createInvalidationChannel, OFFLINE_PROTOCOL_VERSION, within } from "../lib/offline-protocol.ts"

test("worker challenge rejects old, dirty and unresponsive controllers", async () => {
  const worker = (version, clean) => ({ postMessage(_message, ports) {
    ports[0].postMessage({ type: "LR_OFFLINE_STATUS", version, clean })
  } })
  assert.equal(await confirmOfflineController(worker(OFFLINE_PROTOCOL_VERSION, true), 100), true)
  assert.equal(await confirmOfflineController(worker("old", true), 100), false)
  assert.equal(await confirmOfflineController(worker(OFFLINE_PROTOCOL_VERSION, false), 100), false)
  assert.equal(await confirmOfflineController({ postMessage() {} }, 10), false)
  assert.equal(await confirmOfflineController(null, 10), false)
  await assert.rejects(within(new Promise(() => {}), 10), /timed out/)
})

test("two tabs exchange only invalidations; storage fallback is bounded and deduplicated", () => {
  const oldWindow = globalThis.window
  const oldChannel = globalThis.BroadcastChannel
  const listeners = new Set()
  const sent = []
  globalThis.window = {
    addEventListener: (_type, handler) => listeners.add(handler),
    removeEventListener: (_type, handler) => listeners.delete(handler),
    localStorage: { setItem: (key, value) => sent.push({ key, value }), removeItem() {} },
  }
  globalThis.BroadcastChannel = undefined
  let invalidated = 0
  try {
    const tab = createInvalidationChannel(() => { invalidated += 1 })
    assert.equal(tab.send(), true)
    const data = JSON.parse(sent[0].value)
    assert.deepEqual(Object.keys(data).sort(), ["id", "type", "version"])
    for (const handler of listeners) handler({ key: sent[0].key, newValue: sent[0].value })
    for (const handler of listeners) handler({ key: sent[0].key, newValue: sent[0].value })
    assert.equal(invalidated, 1)
    for (const handler of listeners) handler({ key: sent[0].key, newValue: JSON.stringify({ ...data, token: "reject" }) })
    assert.equal(invalidated, 1)
    tab.close()
    assert.equal(listeners.size, 0)
    globalThis.window.localStorage.setItem = () => { throw new Error("blocked") }
    const blocked = createInvalidationChannel(() => {})
    assert.equal(blocked.send(), false)
    blocked.close()
  } finally { globalThis.window = oldWindow; globalThis.BroadcastChannel = oldChannel }
})

test("broadcast reaches another tab without relaying identity or waiting for old tabs", () => {
  const oldWindow = globalThis.window
  const oldChannel = globalThis.BroadcastChannel
  const bus = new Set()
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.BroadcastChannel = class {
    constructor() { bus.add(this) }
    postMessage(data) { for (const other of bus) if (other !== this) other.onmessage?.({ data }) }
    close() { bus.delete(this) }
  }
  let received = 0
  try {
    const first = createInvalidationChannel(() => {})
    const second = createInvalidationChannel(() => { received += 1 })
    assert.equal(first.send(), true)
    assert.equal(received, 1)
    second.close()
    assert.equal(first.send(), true) // No acknowledgment from old tabs is required.
    first.close()
  } finally { globalThis.window = oldWindow; globalThis.BroadcastChannel = oldChannel }
})
