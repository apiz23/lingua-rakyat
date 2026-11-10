import { it, expect } from "vitest"
import { adminHeaders } from "./admin-headers"
it("preserves every HeadersInit representation", () => {
  const inputs: HeadersInit[] = [
    new Headers({ "X-Request-Id": "abc" }),
    [["X-Request-Id", "abc"]],
    { "X-Request-Id": "abc" },
  ]
  for (const headers of inputs)
    expect(adminHeaders({ headers }).get("X-Request-Id")).toBe("abc")
})
it("preserves custom content types and leaves multipart boundaries to fetch", () => {
  expect(
    adminHeaders({ headers: { "Content-Type": "text/plain" } }).get(
      "Content-Type"
    )
  ).toBe("text/plain")
  expect(adminHeaders({ body: new FormData() }).has("Content-Type")).toBe(false)
})
