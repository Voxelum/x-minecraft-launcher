import VueI18n from '@intlify/unplugin-vue-i18n/vite';
import createVuePlugin from '@vitejs/plugin-vue2';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';
import UnoCSS from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vite';

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
  base: '',
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
    '__defProp': 'Object.defineProperty',
  },
  resolve: {
    alias: {
      undici: 'undici-shim',
      '@': join(__dirname, './src'),
      '~main': join(__dirname, './src/windows/main'),
      '~logger': join(__dirname, './src/windows/logger'),
      '~setup': join(__dirname, './src/windows/setup'),
      '@vue/composition-api': 'vue',
      'vue-demi': resolve(__dirname, '../node_modules/vue-demi/lib/index.mjs'),
      'vue-i18n-bridge':
        'vue-i18n-bridge/dist/vue-i18n-bridge.runtime.esm-bundler.js',
    },
  },
  optimizeDeps: {
    exclude: ['electron', '@xmcl/utils', '@xmcl/resource', '@microsoft/applicationinsights-web'],
    esbuildOptions: {
      minify: false,
      keepNames: true,
      supported: {
        'dynamic-import': true,
      },
    },
  },
  plugins: [
    createVuePlugin(),
    UnoCSS(),
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
        filepath: './.eslintrc-auto-import.json',
        globalsPropValue: true,
      },
    }),
  ],
})

