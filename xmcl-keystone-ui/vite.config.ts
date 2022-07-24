import { join, resolve } from 'path'
// const { external } = require("../package.json");
import { createVuePlugin } from 'vite-plugin-vue2'
import { defineConfig } from 'vite'
import { readdirSync } from 'fs'
import { VitePWA } from 'vite-plugin-pwa'
import YAML from '@modyfi/vite-plugin-yaml'
import WindiCSS from 'vite-plugin-windicss'
import ScriptSetup from 'unplugin-vue2-script-setup/vite'
import AutoImport from 'unplugin-auto-import/vite'
import I18n from '@intlify/vite-plugin-vue-i18n'

const entries = readdirSync(join(__dirname, './src'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => join(__dirname, './src', f))

const mainLocalPath = [
  resolve(__dirname, 'src', 'windows', 'main', 'locales/**'),
  resolve(__dirname, 'src', 'windows', 'browser', 'locales/**'),
  resolve(__dirname, 'src', 'windows', 'logger', 'locales/**'),
  resolve(__dirname, 'src', 'windows', 'setup', 'locales/**'),
]
const i18nPlugin = I18n({
  runtimeOnly: false,
  compositionOnly: false,
  include: mainLocalPath,
  forceStringify: true,
  defaultSFCLang: 'yaml',
})

const modifiedI18nPlugin = {
  ...i18nPlugin,
  async transform(this: any, code: string, id: string) {
    const result: any = await i18nPlugin.transform!.call(this, code, id)
    if (result && id.indexOf('vue') !== -1) {
      const lines = result.code.split('\n') as string[]
      const lang = lines[3].slice('    "locale": "'.length, lines[3].length - 2)
      const jsonContent = lines.slice(4, lines.length - 2)
      jsonContent[0] = jsonContent[0].replace('"resource":', `"${lang}":`)
      result.code = `export default function (Component) {
  Component.options.i18n = Component.options.i18n || { "messages": {} }
  Object.assign(Component.options.i18n.messages, {
    ${jsonContent.join('\n')}
  })
}`
    }
    return result
  },
}

/**
 * Vite shared config, assign alias and root dir
 */
export default defineConfig({
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
        // extract: {
        //     include: [join(__dirname, '../src')],
        //     exclude: ['**/node_modules/**', '.git'],
        // }
      },
      scan: {
        dirs: [join(__dirname, './src')],
        fileExtensions: ['vue', 'ts'],
      },
    }),

    modifiedI18nPlugin,

    // YAML(),
    ScriptSetup({ reactivityTransform: true }),
    AutoImport({
      imports: [
        '@vue/composition-api',
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
