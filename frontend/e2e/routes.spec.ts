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
  // This route fetches on the Next server. The test server must load the
  // SSR fixture in qa/ui01d-share-fetch.cjs; browser interception cannot mock it.
  const response = await page.goto("/share/qa-smoke")
  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).toContainText("Eligibility?")
})

test("auth routes render Clerk sign-in and sign-up controls", async ({ page }) => {
  for (const [path, control] of [["/sign-in", "Sign in"], ["/sign-up", "Create account"]]) {
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
  await expect(page).toHaveURL(url => url.pathname === "/sign-in" && url.searchParams.get("redirect_url") === "/manage");
  await expect(page.getByRole("heading", { name: "Continue to your workspace" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Administration navigation" })).toHaveCount(0)
  await expect(page.getByRole("navigation", { name: "Research navigation" })).toHaveCount(0)
  await page.goto("/eval")
  await expect(page.getByRole("navigation", { name: "Research navigation" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Administration navigation" })).toHaveCount(0)
})
