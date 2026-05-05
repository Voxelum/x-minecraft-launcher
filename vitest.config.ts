import { defineConfig } from 'vitest/config'
import { join } from 'path'

export default defineConfig({
  test: {
    setupFiles: [join(__dirname, './test-setup.ts')],
    sequence: {
    },
    globals: true,
    coverage: {
      provider: 'v8',
    },
  },
})
