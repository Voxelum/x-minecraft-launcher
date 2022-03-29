import { join, resolve } from 'path'
// const { external } = require("../package.json");
import { createVuePlugin } from 'vite-plugin-vue2'
import { defineConfig } from 'vite'
import { readdirSync } from 'fs'
import { VitePWA } from 'vite-plugin-pwa'
import YAML from '@modyfi/vite-plugin-yaml'
import WindiCSS from 'vite-plugin-windicss'
import ScriptSetup from 'unplugin-vue2-script-setup/vite'

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
      '/@shared': '../xmcl-runtime-api/src',
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
  ],
})
