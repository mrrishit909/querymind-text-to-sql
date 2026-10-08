import type { Page } from '@playwright/test'

export async function skipIntro(page: Page) {
  const skip = page.locator('.intro-skip')
  if (await skip.isVisible().catch(() => false)) {
    await skip.click()
  }
}

export async function waitForEngineLive(page: Page, timeout = 45_000) {
  await page.locator('.ledger').getByText(/LIVE|showing recorded verdicts|unavailable/).first().waitFor({ timeout })
}
