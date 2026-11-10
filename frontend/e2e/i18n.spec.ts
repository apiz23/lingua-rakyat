import { test, expect } from "@playwright/test"
test.use({ browserName: "chromium" })
test.setTimeout(120_000)

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Unavailable in translation test" }),
    })
  )
})

for (const locale of ["en", "ms"]) {
  test(`${locale}: all public and citizen surfaces render with the requested document language`, async ({
    page,
  }) => {
    for (const route of [
      "/",
      "/about",
      "/results",
      "/sign-in",
      "/sign-up",
      "/workspace",
      "/profile",
      "/shares",
      "/eval",
      "/benchmark",
    ]) {
      const response = await page.goto(
        `/${locale}${route === "/" ? "" : route}`,
        { waitUntil: "domcontentloaded" }
      )
      expect(response?.status(), route).toBe(200)
      await expect(page.locator("html")).toHaveAttribute("lang", locale)
      await expect(page.locator("body")).not.toContainText("Application error")
    }
  })
  test(`${locale}: signed-out admin subroutes retain language and return destination`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/manage/documents`)
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/sign-in\\?redirect_url=%2Fmanage%2Fdocuments`)
    )
    await expect(
      page.getByRole("heading", {
        name:
          locale === "ms"
            ? "Teruskan ke ruang kerja anda"
            : "Continue to your workspace",
      })
    ).toBeVisible()
  })
}

test("switching languages preserves the current route, query and fragment", async ({
  page,
}) => {
  await page.goto("/en/sign-in?redirect_url=%2Fmanage#account")
  await page.getByRole("button", { name: "Bahasa Melayu", exact: true }).click()
  await expect(page).toHaveURL(/\/ms\/sign-in\?redirect_url=%2Fmanage#account$/)
  await expect(
    page.getByRole("heading", { name: "Teruskan ke ruang kerja anda" })
  ).toBeVisible()
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("lang", "ms")
  await page.getByRole("link", { name: "Teruskan tanpa log masuk" }).click()
  await expect(page).toHaveURL(/\/ms\/workspace$/)
})

test("translation endpoints expose English/Malay catalogs and reject invalid locales", async ({
  request,
}) => {
  for (const locale of ["en", "ms"]) {
    const response = await request.get(`/api/i18n/${locale}`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.locale).toBe(locale)
    expect(body.messages["Sign in"]).toBe(
      locale === "ms" ? "Log masuk" : "Sign in"
    )
  }
  expect((await request.get("/api/i18n/fr")).status()).toBe(404)
})
