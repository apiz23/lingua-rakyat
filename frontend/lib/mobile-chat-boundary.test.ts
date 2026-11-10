import { it, expect } from "vitest"
import { parseChatStreamEvent } from "../../mobile/src/chat-stream"
it("mobile rejects incomplete completion and invalid source payloads", () => {
  expect(parseChatStreamEvent({ type: "complete" })).toBeNull()
  expect(parseChatStreamEvent({ type: "sources", sources: [null] })).toBeNull()
  const event = {
    type: "complete",
    answer: "hello",
    language: "en",
    sources: [],
    confidence: 0.7,
    latency_ms: 12,
    model_used: "model",
    sufficient_evidence: true,
    cached: false,
  }
  expect(parseChatStreamEvent(event)).toMatchObject(event)
  expect(parseChatStreamEvent({ ...event, sources: [{}] })).toBeNull()
})
