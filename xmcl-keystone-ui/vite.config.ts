import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import createVuePlugin from '@vitejs/plugin-vue2'
import { readdirSync } from 'fs'
import { join, resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import UnoCSS from 'unocss/vite'

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
    minify: 'terser',
    sourcemap: true,
    terserOptions: {
      keep_classnames: true,
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
      '@vue/composition-api': 'vue',
      'vue-i18n-bridge':
        'vue-i18n-bridge/dist/vue-i18n-bridge.runtime.esm-bundler.js',
    },
  },
  optimizeDeps: {
    exclude: ['electron'],
    esbuildOptions: {
      minify: false,
      keepNames: true,
    },
  },
  plugins: [
    createVuePlugin(),
    UnoCSS(),
    // WindiCSS({
    //   config: {
    //     important: true,
    //   },
    //   scan: {
    //     dirs: [join(__dirname, './src')],
    //     fileExtensions: ['vue', 'ts'],
    //   },
    // }),

    VueI18n({
      include: [
        resolve(__dirname, 'locales/**'),
      ],
      esm: true,
      strictMessage: false,
      bridge: false,
    }),

    AutoImport({
      imports: [
        'vue',
        {
          'vue-i18n-bridge': [
            'useI18n',
          ],
          'vue-router/composables': [
            'useRouter',
            'useRoute',
          ],
        },
      ],
      dts: 'auto-imports.d.ts',
      exclude: ['node_modules', /xmcl\/packages.+/],
      eslintrc: {
        enabled: true,
        filepath: './.eslintrc-auto-import.json', // Default `./.eslintrc-auto-import.json`
        globalsPropValue: true, // Default `true`, (true | false | 'readonly' | 'readable' | 'writable' | 'writeable')
      },
    }),
  ],
})
