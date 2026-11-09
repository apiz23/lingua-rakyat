import { expect, test, type Page } from "@playwright/test"

async function ready(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded))
}
for (const width of [375, 430, 768, 1024, 1440]) {
  test(`sidebar focus, Escape and collapse at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/workspace')
    await ready(page)
    const trigger = page.getByRole('button', { name: 'Toggle Sidebar', exact: true })
    if (width < 768) {
      await trigger.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect.poll(() => dialog.evaluate(e => e.contains(document.activeElement))).toBe(true)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await trigger.click()
      await expect(dialog).toBeVisible()
      await page.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(dialog).toHaveCount(0)
    } else {
      const sidebar = page.locator('[data-slot="sidebar"][data-state]')
      await expect(sidebar).toHaveAttribute('data-state', 'expanded')
      await page.keyboard.press('Control+b')
      await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
      await page.keyboard.press('Escape')
      await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
      await trigger.click()
      await expect(sidebar).toHaveAttribute('data-state', 'expanded')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
  test(`research pointer and keyboard sections at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/eval')
    await ready(page)
    const nav = page.getByRole('navigation', { name: 'Evaluation sections' })
    const accuracy = nav.getByRole('button', { name: 'Answer Accuracy Test', exact: true })
    await accuracy.click()
    await expect(accuracy).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/The system runs a set of pre-written questions/)).toBeVisible()
    const language = nav.getByRole('button', { name: 'Language Simplification', exact: true })
    await language.focus()
    await page.keyboard.press('Enter')
    await expect(language).toHaveAttribute('aria-pressed', 'true')
    await expect(accuracy).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText(/The system runs a set of pre-written questions/)).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
