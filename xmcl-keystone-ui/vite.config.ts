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
    host: '0.0.0.0',
    port: 3000,
  },
  root: join(__dirname, './src'),
  base: '', // has to set to empty string so the html assets path will be relative
  build: {
    rollupOptions: {
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
          '@/composables/windowController': [
            'windowController',
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

