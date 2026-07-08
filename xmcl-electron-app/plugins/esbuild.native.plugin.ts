import { Plugin, build as esbuild } from 'esbuild'
import { existsSync } from 'fs'
import { readdir, readFile, link, unlink, stat, writeFile, mkdir } from 'fs/promises'
import { arch, platform } from 'os'
import { basename, dirname, join, relative } from 'path'

/**
 * Correctly handle native node import.
 */
export default function createNativeModulePlugin(nodeModules: string): Plugin {
  // Shared once across the main build and every nested worker build (the same
  // plugin instance is reused, so `setup` runs multiple times but this closure
  // is created once). Guards the one-time build of the shared iconv-lite chunk.
  let iconvShared: Promise<void> | undefined
  return {
    name: 'resolve-native-module',
    setup(build) {
      const isDev = build.initialOptions.plugins!.find(v => v.name === 'dev')
      if (isDev) {
        build.onLoad(
          { filter: /^.+[\\/]node_modules[\\/].+[\\/]default-gateway[\\/]index\.js$/ },
          async ({ path }) => {
            const content = await readFile(path, 'utf-8')
            const plat = platform()
            return {
              contents: content.replace(/`\.\/\${file}\.js`/, JSON.stringify(join(dirname(path), `${plat}.js`))),
              loader: 'js',
            }
          },
        )
      }

      build.onLoad(
        { filter: /^.+node-sqlite3-wasm[\\/]dist[\\/]node-sqlite3-wasm\.js$/ },
        async ({ path }) => {
          let content = (await readFile(path, 'utf-8'))
          content = content.replace('get isFinalized(){return this._ptr===null}',
            'get isFinalized(){return this._ptr===null}' +
            'isReader(){return sqlite3.column_count(this._ptr)>=1}',
          )
          // Emit the wasm as a single shared file (via esbuild's `file` loader)
          // and load it from disk at runtime, instead of inlining ~1.6MB of
          // base64 into every bundle (main + each worker). All esbuild builds
          // write `node-sqlite3-wasm.wasm` (assetNames: '[name]') into the same
          // `dist` outdir, so the copies collapse into one file. Electron's asar
          // fs shim lets the runtime `fs.readFileSync` it from inside app.asar.
          content = content.replace('"node-sqlite3-wasm.wasm"', 'require("./node-sqlite3-wasm.wasm")')
          return {
            contents: content,
            loader: 'js',
          }
        },
      )

      // undici ships its llhttp parser as two base64-encoded wasm modules
      // (`llhttp-wasm.js` + `llhttp_simd-wasm.js`, ~70KB base64 each). Both are
      // statically `require`d by client-h1.js, so esbuild inlines BOTH into
      // every bundle (main + each worker) — ~840KB duplicated across 6 bundles.
      // Decode each once at build time, emit it as a single shared `.wasm`
      // (via esbuild's `file` loader), and read it from disk at runtime.
      build.onLoad(
        { filter: /undici[\\/]lib[\\/]llhttp[\\/]llhttp(_simd)?-wasm\.js$/ },
        async ({ path }) => {
          const content = await readFile(path, 'utf-8')
          const match = content.match(/wasmBase64\s*=\s*'([A-Za-z0-9+/=]+)'/)
          if (!match) {
            // Format changed upstream; fall back to the original inlined module.
            return { contents: content, loader: 'js' }
          }
          const cacheDir = join(nodeModules, '.cache', 'xmcl-wasm')
          await mkdir(cacheDir, { recursive: true })
          const wasmFile = join(cacheDir, basename(path).replace(/\.js$/, '.wasm'))
          await writeFile(wasmFile, Buffer.from(match[1], 'base64'))
          return {
            contents: `'use strict'
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
let wasmBuffer
Object.defineProperty(module, 'exports', {
  get: () => wasmBuffer || (wasmBuffer = readFileSync(join(__dirname, require(${JSON.stringify(wasmFile)}))))
})`,
            loader: 'js',
          }
        },
      )

      // iconv-lite (~497KB) gets bundled into every worker that needs charset
      // conversion — the encoding worker directly, and the setup worker
      // transitively via node-disk-info. Bundle it ONCE into a shared
      // `dist/iconv-lite.js` and replace its entry with a tiny stub that
      // requires the shared chunk at runtime. The require path is built
      // dynamically (join at runtime) so esbuild leaves it as a real require
      // instead of re-bundling the library.
      build.onLoad(
        { filter: /iconv-lite[\\/]lib[\\/]index\.js$/ },
        async ({ path }) => {
          const outDir = build.initialOptions.outdir!
          if (!iconvShared) {
            iconvShared = esbuild({
              bundle: true,
              platform: 'node',
              format: 'cjs',
              target: 'es2020',
              entryPoints: [path],
              outfile: join(outDir, 'iconv-lite.js'),
              minifyWhitespace: build.initialOptions.minifyWhitespace,
              minifySyntax: build.initialOptions.minifySyntax,
              keepNames: true,
            }).then(() => undefined)
          }
          await iconvShared
          return {
            contents: "module.exports = require(require('path').join(__dirname, 'iconv-lite.js'))",
            loader: 'js',
          }
        },
      )

      // Intercept node_modules\cpu-features\lib\index.js
      build.onLoad(
        { filter: /^.+cpu-features[\\/]lib[\\/]index\.js$/ },
        async ({ path }) => ({
          contents: `
            module.exports = {
              arch: process.arch === 'ia32' ? 'x86' : process.arch,
            };
            `,
          loader: 'js',
        }),
      )

      // node_modules\.pnpm\png2icons@2.0.1\node_modules\png2icons\lib\UPNG.js
      build.onLoad(
        { filter: /^.+png2icons[\\/]lib[\\/]UPNG\.js$/ },
        async ({ path }) => {
          let content = await readFile(path, 'utf-8')
          content = content.replace(`if (typeof require == "function") {UZIP = require("./UZIP");}  else {UZIP = window.UZIP;}`, 'let UZIP = require("./UZIP");')
          return {
            contents: content,
            loader: 'js',
          }
        }
      )

      // Upstream yauzl 2.x: monkey-patch validateFileName to honour
      // ZipFile#validateFileName. @xmcl/yauzl already ships with this
      // patch baked in, so we only target the upstream pnpm path here.
      build.onLoad(
        { filter: /[\\/]\.pnpm[\\/]yauzl@[^\\/]+[\\/]node_modules[\\/]yauzl[\\/]index\.js$/ },
        async ({ path }) => {
          let content = await readFile(path, 'utf-8')
          content = content.replace(
            'var errorMessage = validateFileName(entry.fileName, self.validateFileNameOptions);',
            `var errorMessage = self.validateFileName ? self.validateFileName(entry) : validateFileName(entry.fileName, self.validateFileNameOptions);`
          )
          return {
            contents: content,
            loader: 'js',
          }
        },
      )

      // Intercept node_modules\node-datachannel\dist\esm\polyfill\RTCPeerConnection.mjs
      build.onLoad(
        { filter: /^.+node-datachannel[\\/]dist[\\/]esm[\\/]polyfill[\\/]RTCPeerConnection\.mjs$/ },
        async ({ path }) => {
          let content = (await
            readFile(path, 'utf-8'))

          // replace `constructor(init = {}) {` to `constructor(init = {}, PeerConnection) {`
          content = content.replace('constructor(config = { iceServers: [], iceTransportPolicy: "all" }) {', 'constructor(config = { iceServers: [], iceTransportPolicy: "all" }, PeerConnection) {')
          // remove the line `import { PeerConnection } from '../lib/index.mjs';`
          content = content.replace(/import { PeerConnection } from '..\/lib\/index.mjs';/, '')

          return {
            contents: content,
            loader: 'js',
          }
        },
      )

      // Intercept node_modules\node-datachannel\dist\esm\lib\node-datachannel.mjs
      build.onLoad(
        { filter: /^.+node-datachannel[\\/]dist[\\/]esm[\\/]lib[\\/]node-datachannel\.mjs$/ },
        async ({ path }) => {
          return {
            contents: `
            import mod from '../../../build/Release/node_datachannel.node';
            export default mod;
            `,
            loader: 'js',
          }
        },
      )

      // Intercept node_modules\node-datachannel\dist\esm\lib\index.mjs
      // manually tree shaking
      build.onLoad(
        { filter: /^.+node-datachannel[\\/]dist[\\/]esm[\\/]lib[\\/]node-datachannel\.mjs$/ },
        async ({ path }) => {
          return {
            contents: `import nodeDataChannel from './node-datachannel.mjs'; const PeerConnection = nodeDataChannel.PeerConnection; export { PeerConnection };`,
            loader: 'js',
          }
        },
      )

      if (!isDev) {
        const opts = build.initialOptions
        opts.loader = opts.loader || {}
        opts.loader['.dll'] = 'file'
        opts.loader['.so'] = 'file'
      }
    },
  }
}
