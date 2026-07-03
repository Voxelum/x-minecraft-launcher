import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import { readdirSync } from 'fs'
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

