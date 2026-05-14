import { defineConfig } from 'vitest/config'
import { join } from 'path'

export default defineConfig({
  test: {
    setupFiles: [join(__dirname, './test-setup.ts')],
    // The `e2e/` package is a separate Playwright project (see e2e/README.md)
    // and is intentionally outside the pnpm workspace. Vitest still walks the
    // tree, so we exclude its specs explicitly to avoid empty "0 test" runs.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    sequence: {
    },
    globals: true,
    coverage: {
      provider: 'v8',
    },
  },
})
