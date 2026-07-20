import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import { readdirSync } from 'fs'
import type { LengthValue } from 'lightningcss'
import { join, resolve } from 'path'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

// Multi-page renderer — one html entry per launcher window (main /
// app / browser / logger / migration / multiplayer). All html files in
// `src/` are picked up automatically.
const entries = readdirSync(join(__dirname, './src'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => join(__dirname, './src', f))

/**
 * Vite shared config, assign alias and root dir
 */
export default defineConfig({
  server: {
    port: 3000,
  },
  root: join(__dirname, './src'),
  base: '', // has to set to empty string so the html assets path will be relative
  build: {
    // Vite 8 treats `rollupOptions` as an alias of `rolldownOptions` and,
    // when both are set, the latter wins and silently drops the former's
    // `input` / `external`. That regression dropped every html entry
    // except `index.html` from `dist/`, white-screening the multiplayer /
    // browser / logger / migration windows because the html they load
    // 404'd. Keep all rolldown inputs in `rolldownOptions`.
    rolldownOptions: {
      input: entries,
      external: ['electron'],
    },
    minify: 'terser',
    sourcemap: true,
    terserOptions: {
      keep_classnames: true,
      keep_fnames: true,
    },
    outDir: resolve(__dirname, './dist'),
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      undici: 'undici-shim',
      '@': join(__dirname, './src'),
      '~main': join(__dirname, './src/windows/main'),
      '~logger': join(__dirname, './src/windows/logger'),
      '~setup': join(__dirname, './src/windows/setup'),
    },
  },
  css: {
    // Convert every build-time `px` value to `rem` so the whole UI scales
    // with the root `<html>` font-size (see `useStyleTag` in
    // `src/composables/theme.ts`, which injects `html { font-size: <n>px }`
    // at runtime as the single un-converted scale anchor). This lets the
    // theme font-size setting act as a true whole-UI scale — icons, the
    // sidebar and controls included — without `zoom`/`transform`.
    //
    // Implementation: Lightning CSS (Rust) instead of a PostCSS plugin. Its
    // `Length` visitor is the fastest way to do the px→rem rewrite and it
    // runs on ALL CSS Vite processes — our source, Vuetify's compiled CSS
    // and UnoCSS's generated utilities alike. NOTE vs postcss-pxtorem:
    //   * `transformer: 'lightningcss'` disables PostCSS entirely.
    //   * The visitor is global — we CANNOT skip individual `node_modules`
    //     packages, so third-party widget px scales too (acceptable for a
    //     whole-UI scale, but less surgical than the postcss `exclude`).
    //   * The visitor also rewrites `@media` breakpoint lengths to rem, but
    //     this is a no-op in practice: per the Media Queries spec, `rem` in a
    //     media-query condition is anchored to the INITIAL font-size (16px),
    //     never the `<html>` element's cascaded size — so e.g. `60rem`
    //     always means 960px and breakpoints do NOT shift with the UI scale.
    transformer: 'lightningcss',
    lightningcss: {
      visitor: {
        // Keep <2px lengths (1px hairline borders/dividers) fixed — scaling
        // them makes borders blurry or vanish sub-pixel at smaller scales.
        Length(length: LengthValue): LengthValue | void {
          if (length.unit === 'px' && Math.abs(length.value) >= 2) {
            return { unit: 'rem', value: Math.round((length.value / 16) * 1e5) / 1e5 }
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['electron', '@xmcl/utils', '@xmcl/resource'],
    rolldownOptions: {
    },
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    UnoCSS(),

    VueI18n({
      include: [
        resolve(__dirname, 'locales/**'),
      ],
      strictMessage: false,
    }),

    AutoImport({
      imports: [
        'vue',
        {
          'vue-i18n': [
            'useI18n',
          ],
          'vue-router': [
            'useRouter',
            'useRoute',
          ],
        },
      ],
      dts: 'auto-imports.d.ts',
      exclude: ['node_modules', /xmcl\/packages.+/],
      eslintrc: {
        enabled: true,
        filepath: './.eslintrc-auto-import.json',
        globalsPropValue: true,
      },
    }),
  ],
})

