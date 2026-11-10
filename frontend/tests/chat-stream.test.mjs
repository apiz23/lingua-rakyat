import test from "node:test"
import assert from "node:assert/strict"
import { consumeChatSse, parseChatStreamEvent, ChatStreamInterruptedError, getVerificationLifecycleState } from "../lib/chat-stream.ts"

const source = { source_id: "S1", document_id: "doc-1", text: "Synthetic evidence", score: 0.8 }

function verification(status = "verified") {
  return {
    verification_status: status,
    claims: [{
      claim_id: "C1",
      text: "Synthetic supported claim",
      status: status === "verified" ? "supported" : status,
      supporting_source_ids: ["S1"],
      conflicting_source_ids: [],
    }],
    verified_claim_count: status === "verified" ? 1 : 0,
    partially_supported_claim_count: status === "partially_supported" ? 1 : 0,
    unsupported_claim_count: status === "unsupported" ? 1 : 0,
    conflicting_claim_count: status === "conflicting" ? 1 : 0,
    unverifiable_claim_count: status === "unverifiable" ? 1 : 0,
    verification_summary: "Synthetic test result",
    citation_valid: true,
    extraction_complete: true,
    extraction_status: "complete",
    revision_attempted: false,
    abstained: false,
  }
}

function complete(overrides = {}) {
  return {
    type: "complete",
    answer: "Final answer",
    language: "en",
    sources: [source],
    confidence: 0.5,
    latency_ms: 10,
    model_used: "synthetic",
    sufficient_evidence: true,
    cached: false,
    verification: verification(),
    ...overrides,
  }
}

function streamFrom(text, splitAt = []) {
  const encoder = new TextEncoder()
  const parts = []
  let start = 0
  for (const end of splitAt) {
    parts.push(encoder.encode(text.slice(start, end)))
    start = end
  }
  parts.push(encoder.encode(text.slice(start)))
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part)
      controller.close()
    },
  })
}

const frame = (event) => `data: ${JSON.stringify(event)}\n\n`

test("generation and verification events are parsed as separate lifecycle states", async () => {
  const events = []
  await consumeChatSse(streamFrom(frame({ type: "start" }) + frame({ type: "token", text: "Draft" }) + frame({ type: "verifying" }) + frame(complete())), (event) => events.push(event))
  assert.deepEqual(events.map((event) => event.type), ["start", "token", "verifying", "complete"])
})

test("verified completion requires complete extraction and request-local supporting citations", () => {
  assert.equal(parseChatStreamEvent(complete()).verification.verification_status, "verified")
  for (const invalid of [
    { extraction_complete: false },
    { extraction_status: "incomplete" },
    { citation_valid: false },
    { claims: [] },
    { claims: [{ ...verification().claims[0], supporting_source_ids: [] }] },
    { claims: [{ ...verification().claims[0], supporting_source_ids: ["FOREIGN"] }] },
    { claims: [{ ...verification().claims[0], status: "partially_supported" }] },
    { claims: [{ ...verification().claims[0], conflicting_source_ids: ["S1"] }] },
  ]) {
    const event = parseChatStreamEvent(complete({ verification: { ...verification(), ...invalid } }))
    assert.equal(event.verification, null)
  }
})

test("a provisional answer is never assigned a verified lifecycle state", () => {
  assert.equal(getVerificationLifecycleState({ isStreaming: true, verification: verification() }), "generating")
  assert.equal(getVerificationLifecycleState({ isStreaming: true, verifying: true, verification: verification() }), "verifying")
  assert.equal(getVerificationLifecycleState({ verification: verification(), sources: [source] }), "verified")
})

test("partial, conflicting, unsupported and unavailable outcomes remain non-verified", () => {
  for (const status of ["partially_supported", "conflicting", "unsupported", "unverifiable"]) {
    const event = parseChatStreamEvent(complete({ verification: verification(status) }))
    assert.equal(event.verification.verification_status, status)
  }
  assert.equal(parseChatStreamEvent(complete({ verification: null })).verification, null)
})

test("the final complete answer replaces streamed provisional text and duplicate completes are ignored", async () => {
  const events = []
  const body = frame({ type: "token", text: "Provisional text" }) + frame(complete({ answer: "Authoritative revised answer" })) + frame(complete({ answer: "Duplicate stale answer" })) + frame({ type: "suggestions", questions: ["Follow-up"] })
  await consumeChatSse(streamFrom(body, [9, 28, 51]), (event) => events.push(event))
  const final = events.filter((event) => event.type === "complete")
  assert.equal(final.length, 1)
  assert.equal(final[0].answer, "Authoritative revised answer")
  assert.deepEqual(events.at(-1), { type: "suggestions", questions: ["Follow-up"] })
})

test("older complete response without verification stays displayable but unverified", () => {
  const event = parseChatStreamEvent(complete({ verification: undefined }))
  assert.equal(event.type, "complete")
  assert.equal(event.verification, null)
})

test("malformed verification metadata cannot produce a verified badge", () => {
  for (const malformed of [{ verification_status: "verified" }, "bad", { ...verification(), extraction_complete: "true" }]) {
    const event = parseChatStreamEvent(complete({ verification: malformed }))
    assert.equal(event.verification, null)
  }
})

test("malformed SSE frames are ignored and a later valid completion is accepted", async () => {
  const events = []
  await consumeChatSse(streamFrom("data: {broken json}\n\n" + frame({ type: "token", text: "Draft" }) + frame(complete())), (event) => events.push(event))
  assert.deepEqual(events.map((event) => event.type), ["token", "complete"])
})

test("stream EOF before complete is reported as interruption", async () => {
  await assert.rejects(
    consumeChatSse(streamFrom(frame({ type: "token", text: "Provisional" })), () => {}),
    ChatStreamInterruptedError,
  )
})

test("SSE error is terminal and does not make provisional text a final answer", async () => {
  const events = []
  await consumeChatSse(streamFrom(frame({ type: "token", text: "Provisional" }) + frame({ type: "error", detail: "failed" }) + frame(complete())), (event) => events.push(event))
  assert.deepEqual(events.map((event) => event.type), ["token", "error"])
})

test("empty final answer is accepted as a completion but never marked verified", () => {
  const event = parseChatStreamEvent(complete({ answer: "" }))
  assert.equal(event.type, "complete")
  assert.equal(event.verification, null)
})
