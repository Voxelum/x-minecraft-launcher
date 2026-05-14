import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Locale matrix is intentionally minimal in this PR (en only).
// Adding more locales is a one-line change: read process.env.XMCL_E2E_LOCALES.
const locales = (process.env.XMCL_E2E_LOCALES ?? 'en').split(',').map((s) => s.trim())

export default defineConfig({
  testDir: './specs',
  outputDir: './artifacts/test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // Each test launches a real Electron process; serialize to keep CI stable.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: './artifacts/playwright-report', open: 'never' }],
    ['json', { outputFile: './artifacts/test-results.json' }],
  ],
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: locales.map((locale) => ({
    name: `electron-${locale}`,
    use: {
      // Carried into the launcher fixture via testInfo.project.use.
      locale,
    } as Record<string, unknown>,
    metadata: {
      locale,
      electronAppPath: resolve(__dirname, '../xmcl-electron-app/dist/index.js'),
    },
  })),
})
