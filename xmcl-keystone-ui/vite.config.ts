import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import { readdirSync } from 'fs'
import { join, resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

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
    rollupOptions: {
      input: entries,
      external: ['electron'],
    },
    // Workaround for vitejs/vite#22583 + vbenjs/vue-vben-admin#7955:
    // rolldown 1.0.2+ (bundled with vite >= 8.0.14) drops `init_*_esm_bundler`
    // helpers across chunks in multi-entry Vue builds when its internal
    // minifier runs. Disabling rolldown's minify and letting terser handle
    // minification keeps Vue's circular ESM helpers wired correctly.
    // The `minify` field exists on rolldown's RolldownOptions but isn't
    // re-exported by vite's type — drop the cast once vite types catch up.
    rolldownOptions: ({ minify: false } as any),
    minify: 'terser',
    sourcemap: true,
    terserOptions: {
      keep_classnames: true,
      keep_fnames: true,
    },
    outDir: resolve(__dirname, './dist'),
    assetsInlineLimit: 0,
  },
  define: {
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

