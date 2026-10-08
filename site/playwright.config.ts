import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'tests/playwright/results.json' }]],
  use: {
    baseURL: 'http://localhost:4321/querymind-text-to-sql/',
    trace: 'off',
  },
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://localhost:4321/querymind-text-to-sql/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
