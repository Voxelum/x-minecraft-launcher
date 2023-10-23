import { defineConfig } from 'unocss/vite'
import transformerDirectives from '@unocss/transformer-directives'

export default defineConfig({
  preprocess: (t: string) => {
    if (t.includes('!')) {
      return t
    }
    return `!${t}`
  },
  transformers: [
    transformerDirectives(),
  ],
})
