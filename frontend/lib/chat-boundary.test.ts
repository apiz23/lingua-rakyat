import { describe, it, expect } from "vitest"
import { parseChatStreamEvent } from "./chat-stream"

describe("chat source boundary", () => {
  for (const sources of [
    [null],
    [{}],
    [{ text: "x", document_id: 4, score: 1 }],
    [{ text: "x", document_id: "d", score: 1, page_start: "2" }],
  ]) {
    it(`rejects malformed sources ${JSON.stringify(sources)}`, () => {
      expect(parseChatStreamEvent({ type: "sources", sources })).toBeNull()
      expect(
        parseChatStreamEvent({ type: "complete", answer: "x", sources })
      ).toBeNull()
    })
  }
  it("accepts real source fields", () => {
    const sources = [
      { text: "x", document_id: "d", score: 0.7, page_start: null },
    ]
    expect(parseChatStreamEvent({ type: "sources", sources })).toEqual({
      type: "sources",
      sources,
    })
  })
})
