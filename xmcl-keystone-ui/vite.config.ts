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

const entries = readdirSync(join(__dirname, './src'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => join(__dirname, './src', f))

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
  },
  plugins: [
    createVuePlugin(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'x-minecraft-launcher',
        short_name: 'xmcl',
        description: 'A progressive electron based Minecraft Launcher',
      },
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

    YAML(),
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
