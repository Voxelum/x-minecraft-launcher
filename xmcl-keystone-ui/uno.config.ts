import { defineConfig } from 'unocss/vite'

export default defineConfig({
  preprocess: (t: string) => {
    if (t.includes('!')) {
      return t
    }
    return `!${t}`
  },
})