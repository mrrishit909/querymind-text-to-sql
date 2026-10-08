import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { skipIntro } from './helpers'

test('zero serious/critical axe violations on the hero + beats', async ({ page }) => {
  await page.goto('/')
  await skipIntro(page)
  await page.locator('#ledger').scrollIntoViewIfNeeded() // forces all beats into the DOM/visible range
  const results = await new AxeBuilder({ page }).include('body').analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
})

test('visible focus ring on interactive elements', async ({ page }) => {
  await page.goto('/')
  await skipIntro(page)
  // Real keyboard navigation (not a scripted .focus()) so Chromium's
  // focus-visible heuristic actually engages, matching how a keyboard user
  // experiences it.
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle)
  expect(outline).not.toBe('none')
})

test('reduced motion: intro shows static end state and content is not removed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  // Either the intro renders its static frames, or auto-skip already fired.
  await page.locator('.intro-skip, header.topbar').first().waitFor({ timeout: 10_000 })
  await skipIntro(page)
  await expect(page.locator('header.topbar')).toBeVisible()
})
