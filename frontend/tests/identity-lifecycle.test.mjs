import test from "node:test"
import assert from "node:assert/strict"
import { createIdentityLifecycle, resolveIdentity } from "../lib/identity-lifecycle.ts"
import { consumeChatSse } from "../lib/chat-stream.ts"

test("identity and session transitions invalidate all overlapping callbacks", () => {
  const lifetime = createIdentityLifecycle()
  const actorA = lifetime.begin()
  const renderA = lifetime.snapshot()
  const historyA = lifetime.begin()
  lifetime.invalidate() // sign-out or direct A -> B
  const visible = []
  for (const kind of ["token", "complete", "history", "finally", "sources", "pdf"]) {
    if (actorA.current()) visible.push(kind)
  }
  assert.deepEqual(visible, [])
  assert.equal(actorA.signal.aborted, true)
  assert.equal(historyA.signal.aborted, true)
  assert.equal(actorA.current(), false)
  assert.equal(renderA(), false)
  assert.equal(historyA.current(), false)
  const actorB = lifetime.begin()
  assert.equal(actorB.current(), true)
  lifetime.invalidate() // same actor, different session
  assert.equal(actorB.current(), false)
  const nextSession = lifetime.begin()
  assert.equal(nextSession.current(), true)
  lifetime.close() // unmount
  assert.equal(nextSession.signal.aborted, true)
  assert.equal(nextSession.current(), false)
})

test("stream cancellation rejects and discards late data", async () => {
  const controller = new AbortController()
  let cancelled = false
  const stream = new ReadableStream({
    start() {},
    cancel() { cancelled = true },
  })
  const events = []
  const pending = consumeChatSse(stream, (event) => events.push(event), controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: "AbortError" })
  assert.equal(cancelled, true)
  assert.deepEqual(events, [])
})
test("unresolved identities never become anonymous, and A and B have distinct boundaries", () => {
  assert.equal(resolveIdentity(false, undefined).state, "loading")
  assert.equal(resolveIdentity(true, true, null).state, "transitioning")
  assert.equal(resolveIdentity(true, false).state, "signed_out")
  const a = resolveIdentity(true, true, "A")
  const b = resolveIdentity(true, true, "B")
  assert.equal(a.state, "signed_in")
  assert.notEqual(a.key, b.key)
  assert.notEqual(a.key, resolveIdentity(true, false).key)
})

