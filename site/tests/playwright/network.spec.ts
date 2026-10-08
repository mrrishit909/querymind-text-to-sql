import { test, expect } from '@playwright/test'
import { skipIntro, waitForEngineLive } from './helpers'

test('zero requests to any non-origin URL, and the local Pyodide/sqlglot assets really are fetched', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (req) => requests.push(req.url()))

  await page.goto('/')
  await skipIntro(page)
  await waitForEngineLive(page, 60_000)

  const origin = new URL(page.url()).origin
  const external = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'))
  expect(external, `external requests seen: ${JSON.stringify(external, null, 2)}`).toEqual([])

  // A zero-external-requests assertion proves nothing if the worker never
  // actually fetched anything. Confirm the self-hosted wasm and the pinned
  // local sqlglot wheel were really requested (not stubbed, not CDN).
  expect(requests.some((u) => u.includes('pyodide.asm.wasm'))).toBe(true)
  expect(requests.some((u) => u.includes('sqlglot-30.21.0-py3-none-any.whl'))).toBe(true)
  expect(requests.some((u) => u.includes('pyodide-lock.json'))).toBe(true)
})

test('fonts are self-hosted (no Google Fonts stylesheet link)', async ({ page }) => {
  await page.goto('/')
  const googleFontsLinks = await page.locator('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').count()
  expect(googleFontsLinks).toBe(0)
})
