import { test, expect } from '@playwright/test'
import { skipIntro, waitForEngineLive } from './helpers'

// These exercise the REAL Pyodide-loaded sql_validator.py in a real
// Chromium tab -- no mocking of the worker, the wasm, or the wheel.
test.describe('live Pyodide validator', () => {
  test('page loads and the intro is skippable', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.intro-skip')).toBeVisible()
    await skipIntro(page)
    await expect(page.locator('.intro-screen')).toHaveCount(0)
    await expect(page.locator('header.topbar')).toBeVisible()
  })

  test('engine reaches LIVE with full parity on the recorded corpus', async ({ page }) => {
    await page.goto('/')
    await skipIntro(page)
    await waitForEngineLive(page, 60_000)
    const ledgerText = await page.locator('.ledger').innerText()
    expect(ledgerText).toContain('sha')
    // Full parity is the whole point of the LIVE badge (interaction-map.md).
    expect(ledgerText).toMatch(/LIVE|parity \d+\/\d+/)
  })

  test('console: a legit query is really accepted by the real validator', async ({ page }) => {
    await page.goto('/')
    await skipIntro(page)
    await page.locator('#judge').scrollIntoViewIfNeeded()
    const input = page.locator('#console-input')
    await input.fill('SELECT city, COUNT(*) AS n FROM v_customers GROUP BY city ORDER BY n DESC')
    await expect(page.locator('.console-verdict .verdict-accept')).toBeVisible({ timeout: 10_000 })
  })

  test('console: the historical bypass is REJECTED by the current validator, at gate 10', async ({ page }) => {
    await page.goto('/')
    await skipIntro(page)
    await page.locator('#judge').scrollIntoViewIfNeeded()
    const input = page.locator('#console-input')
    await input.fill("WITH pg_roles AS (SELECT 1 AS x FROM v_customers) SELECT rolname, rolsuper FROM pg_catalog.pg_roles")
    const verdict = page.locator('.console-verdict .verdict-reject')
    await expect(verdict).toBeVisible({ timeout: 10_000 })
    const text = await verdict.innerText()
    expect(text).toContain('gate 10')
    await expect(page.locator('.console-verdict')).toContainText('unapproved table/view referenced: pg_roles')
  })

  test('console: a DROP is rejected (adversarial statement-type case)', async ({ page }) => {
    await page.goto('/')
    await skipIntro(page)
    await page.locator('#judge').scrollIntoViewIfNeeded()
    await page.locator('#console-input').fill('DROP TABLE customers')
    await expect(page.locator('.console-verdict .verdict-reject')).toBeVisible({ timeout: 10_000 })
  })

  test('breach replay: the same query gets a different real outcome under before vs. current', async ({ page }) => {
    await page.goto('/')
    await skipIntro(page)
    await page.locator('#breach').scrollIntoViewIfNeeded()
    const exhibit = page.locator('.exhibit').first()
    // Default state (fix not applied): the real pre-fix validator accepts
    // the attack and the 18 recorded leaked rows are shown.
    await expect(exhibit.getByText('postgres', { exact: false })).toBeVisible({ timeout: 10_000 })
    const fixSwitch = page.getByRole('switch', { name: /apply the fix/i })
    await fixSwitch.click()
    // After the fix: the current validator rejects it, no leaked rows.
    await expect(exhibit.getByText('0 rows · rejected before the database saw it')).toBeVisible({ timeout: 10_000 })
    await expect(exhibit.getByText('postgres', { exact: false })).toHaveCount(0)
  })

  test('builder never shows a fabricated result for a missing combination', async ({ page }) => {
    await page.goto('/')
    await skipIntro(page)
    await page.locator('#build').scrollIntoViewIfNeeded()
    await expect(page.locator('#build .not-precomputed')).toHaveCount(0)
    await expect(page.locator('#build .sql-block')).toBeVisible()
  })
})
