import { join, resolve } from 'path'
import createVuePlugin from '@vitejs/plugin-vue2'
import { defineConfig } from 'vite'
import { readdirSync } from 'fs'
import { VitePWA } from 'vite-plugin-pwa'
import WindiCSS from 'vite-plugin-windicss'
import AutoImport from 'unplugin-auto-import/vite'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'

const entries = readdirSync(join(__dirname, './src'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => join(__dirname, './src', f))

const mainLocalPath = [
  resolve(__dirname, 'src', 'windows', 'main', 'locales/**'),
  resolve(__dirname, 'src', 'windows', 'browser', 'locales/**'),
  resolve(__dirname, 'src', 'windows', 'logger', 'locales/**'),
]

// const modifiedI18nPlugin = {
//   ...i18nPlugin,
//   async transform(this: any, code: string, id: string) {
//     const result: any = await i18nPlugin.transform!.call(this, code, id)
//     if (result && id.indexOf('vue') !== -1) {
//       const lines = result.code.split('\n') as string[]
//       const lang = lines[3].slice('    "locale": "'.length, lines[3].length - 2)
//       const jsonContent = lines.slice(4, lines.length - 2)
//       jsonContent[0] = jsonContent[0].replace('"resource":', `"${lang}":`)
//       result.code = `export default function (Component) {
//   Component.options.i18n = Component.options.i18n || { "messages": {} }
//   Object.assign(Component.options.i18n.messages, {
//     ${jsonContent.join('\n')}
//   })
// }`
//     }
//     return result
//   },
// }

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
      '/@': join(__dirname, './src'),
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
    VitePWA({
      registerType: 'prompt',
      manifest: false,
    }),
    WindiCSS({
      config: {
        important: true,
      },
      scan: {
        dirs: [join(__dirname, './src')],
        fileExtensions: ['vue', 'ts'],
      },
    }),

    VueI18n({
      include: mainLocalPath,
      bridge: false,
    }),

    AutoImport({
      imports: [
        'vue',
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
