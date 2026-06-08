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
  // Per-test budget must cover the 180s waitForAppWindow ceiling in the
  // launcher fixture (Ubuntu CI cold-boots the main process in ~90s) plus
  // the per-test renderer work. 240s leaves a comfortable margin without
  // dragging the suite — non-smoke specs that need longer set their own
  // timeout via test.setTimeout(...) (e.g. specs/05-download-modpack.spec.ts).
  timeout: 240_000,
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
