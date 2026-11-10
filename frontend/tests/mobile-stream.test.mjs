import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)
function load(fetch, authHeader) {
  const source = readFileSync(new URL("../../mobile/src/api.ts", import.meta.url), "utf8")
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  const parserSource = readFileSync(new URL("../../mobile/src/chat-stream.ts", import.meta.url), "utf8")
  const parserCode = ts.transpileModule(parserSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const parser = { exports: {} }
  new Function("require", "module", "exports", parserCode)(require, parser, parser.exports)
  const mocks = { "expo/fetch": { fetch }, "./auth-token": { authHeader }, "./chat-stream": parser.exports }
  new Function("require", "module", "exports", code)((name) => mocks[name] ?? require(name), loaded, loaded.exports)
  return loaded.exports
}
const params = { userId: "A", anonUserId: "anon", documentId: "d", documentName: "D", sessionId: "s", question: "Q", requireAuth: true }

test("mobile 401 does not retry as anonymous", async () => {
  let calls = 0
  const api = load(async () => { calls += 1; return { status: 401 } }, async () => ({ Authorization: "Bearer test" }))
  await assert.rejects(api.askQuestionStream(params, () => {}), (error) => {
    assert.equal(error.name, "AuthRequiredError")
    assert.match(error.message, /sign in again/i)
    return true
  })
  assert.equal(calls, 1)
})

test("mobile cancellation ignores late stream events", async () => {
  let read
  let cancelled = false
  const api = load(async () => ({ status: 200, ok: true, body: { getReader: () => ({
    read: () => new Promise((resolve) => { read = resolve }),
    cancel: async () => { cancelled = true }, releaseLock() {},
  }) } }), async () => ({ Authorization: "Bearer test" }))
  const controller = new AbortController()
  const events = []
  const pending = api.askQuestionStream({ ...params, signal: controller.signal }, (event) => events.push(event))
  await new Promise((resolve) => setTimeout(resolve, 0))
  controller.abort()
  read({ done: false, value: new TextEncoder().encode('data: {"type":"token","text":"private"}\n\n') })
  await assert.rejects(pending, /cancelled/i)
  assert.equal(cancelled, true)
  assert.deepEqual(events, [])
})

test("mobile does not treat an interrupted stream as a completed answer", async () => {
  let readCount = 0
  const api = load(async () => ({ status: 200, ok: true, body: { getReader: () => ({
    read: async () => readCount++ === 0
      ? { done: false, value: new TextEncoder().encode('data: {"type":"token","text":"partial"}\n\n') }
      : { done: true },
    cancel: async () => {}, releaseLock() {},
  }) } }), async () => ({ Authorization: "Bearer test" }))
  await assert.rejects(api.askQuestionStream(params, () => {}), /interrupted/i)
})
