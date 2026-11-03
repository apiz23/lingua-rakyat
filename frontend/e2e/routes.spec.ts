import { expect, test } from "@playwright/test"

const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

test("public home, about and results routes render and link between pages", async ({ page }) => {
  for (const [path, title] of [["/", "Lingua Rakyat"], ["/about", "Architecture"], ["/results", "Project Showcase"]]) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page).toHaveTitle(new RegExp(title))
    await expect(page.locator("body")).not.toContainText("Application error")
  }
  await page.goto("/about")
  await page.getByRole("link", { name: "Home" }).first().click()
  await expect(page).toHaveURL(/\/$/)
})

test("public share route renders from its existing public API contract", async ({ page }) => {
  await page.route(`${apiOrigin}/api/v1/public/shares/qa-smoke`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ slug: "qa-smoke", question: "Eligibility?", answer: "Check the published guidance.", sources: [], language: "en", created_at: new Date().toISOString(), confidence: 0.9, confidence_label: "high", agency: "Test", evidence_linked: false }),
  }))
  const response = await page.goto("/share/qa-smoke")
  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).toContainText("Eligibility?")
})

test("auth routes render Clerk sign-in and sign-up controls", async ({ page }) => {
  for (const [path, control] of [["/sign-in", "Sign in"], ["/sign-up", "Sign up"]]) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.getByText(control, { exact: false }).first()).toBeVisible()
  }
})

test("public routes never expose administration or research navigation", async ({ page }) => {
  await page.route(`${apiOrigin}/api/documents/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
  for (const path of ["/", "/about", "/results"]) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.getByRole("navigation", { name: "Administration navigation" })).toHaveCount(0)
    await expect(page.getByRole("navigation", { name: "Research navigation" })).toHaveCount(0)
  }
})

test("citizen navigation does not expose administration links", async ({ page }) => {
  await page.route(`${apiOrigin}/api/documents/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
  await page.route(`${apiOrigin}/api/v1/me/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
  await page.goto("/workspace")
  await expect(page.getByRole("navigation", { name: "Administration navigation" })).toHaveCount(0)
  await expect(page.locator("body")).not.toContainText("Manage Documents")
})

test("citizen, admin and research routes render their separated navigation", async ({ page }) => {
  await page.route(`${apiOrigin}/api/documents/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
  await page.route(`${apiOrigin}/api/v1/me/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
  await page.route(`${apiOrigin}/api/eval/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }))
  for (const path of ["/workspace", "/profile", "/shares", "/manage", "/eval", "/benchmark"]) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.locator("body")).not.toContainText("Application error")
  }
  await page.goto("/manage")
  await expect(page.getByRole("navigation", { name: "Administration navigation" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Research navigation" })).toHaveCount(0)
  await page.goto("/eval")
  await expect(page.getByRole("navigation", { name: "Research navigation" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Administration navigation" })).toHaveCount(0)
})
