import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  shortcuts: [
  ],
  theme: {
    colors: {
    },
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
  ],
  transformers: [
    // `enforce: 'pre'` forces UnoCSS to expand `@apply`/`@screen`/theme()
    // before Vite's CSS pipeline runs. With `css.transformer: 'lightningcss'`
    // (see vite.config.ts) there is no PostCSS pass to fall back on, and
    // lightningcss's `vite:css-post` transform can otherwise run before this
    // plugin's default-enforce transform hook, seeing raw `@apply` as an
    // unknown at-rule and warning ("[lightningcss] Unknown at rule: @apply").
    transformerDirectives({ enforce: 'pre' }),
    transformerVariantGroup(),
  ],
})
