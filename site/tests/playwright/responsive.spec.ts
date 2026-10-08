import { test, expect } from '@playwright/test'
import { skipIntro } from './helpers'

test.describe('responsive', () => {
  test('no horizontal page scroll at 1440, 768 or 390', async ({ page }) => {
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await skipIntro(page)
      const [scrollWidth, clientWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
      expect(scrollWidth, `width ${width}: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth + 1)
    }
  })

  test('390px: the console defers loading the validator until tapped', async ({ page }) => {
    const wasmRequests: string[] = []
    page.on('request', (req) => { if (req.url().includes('pyodide.asm.wasm')) wasmRequests.push(req.url()) })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await skipIntro(page)
    await page.locator('#judge').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1500)
    expect(wasmRequests.length, 'no Pyodide bytes should be fetched before the console is opened on the 390px spine').toBe(0)

    await page.getByRole('button', { name: /load the validator/i }).click()
    await expect.poll(() => wasmRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
  })

  test('the self-hosted Martian Mono / Instrument Sans / Newsreader files really declare variable axes', async ({ page }) => {
    await page.goto('/')
    await skipIntro(page)
    const axes = await page.evaluate(() => {
      const found: Record<string, { stretch?: string; weight?: string }> = {}
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue
        }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSFontFaceRule) {
            const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim()
            if (!found[family]) found[family] = {}
            const stretch = rule.style.getPropertyValue('font-stretch')
            const weight = rule.style.getPropertyValue('font-weight')
            if (stretch) found[family].stretch = stretch
            if (weight) found[family].weight = weight
          }
        }
      }
      return found
    })
    const rangePattern = /\d+(\.\d+)?%\s+\d+(\.\d+)?%/
    expect(axes['Martian Mono Variable']?.stretch, JSON.stringify(axes)).toMatch(rangePattern)
    expect(axes['Instrument Sans Variable']?.stretch, JSON.stringify(axes)).toMatch(rangePattern)
    expect(axes['Newsreader Variable']?.weight, JSON.stringify(axes)).toMatch(/\d+\s+\d+/)
  })
})
