import { build as esbuild, Plugin } from 'esbuild'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { platform } from 'os'
import { basename, dirname, join } from 'path'

/**
 * Runs `run()` once and caches the result, but re-runs it if `outFile` is
 * missing by the time a caller awaits the cached promise. This plugin's
 * closures (and their caches) are reused across every nested worker build AND
 * across separate top-level `esbuild()` invocations for each mac arch
 * (electron-builder's `beforeBuild` calls `buildMain()` — which does
 * `emptyDir(dist)` — once per arch, sequentially, in the same process). A
 * bare "already ran" flag would let a later arch's `emptyDir` silently delete
 * the file an earlier arch's cached promise already resolved for, shipping a
 * bundle that requires a file nothing ever recreates (macOS 0.63.0-0.63.2,
 * issue #1576). Checking `existsSync` before trusting the cache keeps the
 * "write/bundle this shared chunk once" dedup intact within a single build
 * while staying correct across `emptyDir` wipes between builds.
 */
function createOnceCache() {
  let promise: Promise<void> | undefined
  return async (outFile: string, run: () => Promise<unknown>) => {
    if (!promise) {
      promise = run().then(() => undefined)
    }
    await promise
    if (!existsSync(outFile)) {
      promise = run().then(() => undefined)
      await promise
    }
  }
}

/**
 * Correctly handle native node import.
 */
export default function createNativeModulePlugin(): Plugin {
  // Shared once across the main build and every nested worker build (the same
  // plugin instance is reused, so `setup` runs multiple times but this closure
  // is created once). Guards the one-time build of the shared iconv-lite chunk.
  const iconvShared = createOnceCache()
  // Same rationale for the decoded undici wasm files: the main build and every
  // nested worker build run concurrently and share this plugin instance, so
  // without a guard they all race to `writeFile` the same `dist/*.wasm` file.
  // Keyed by wasm file path since `llhttp-wasm.wasm` and `llhttp_simd-wasm.wasm`
  // each need their own cache.
  const wasmShared = new Map<string, ReturnType<typeof createOnceCache>>()
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
        { filter: /@azure[\\/]msal-node-runtime[\\/]dist[\\/]index\.cjs$/ },
        async ({ path }) => {
          const content = await readFile(path, 'utf-8')
          return {
            contents: content.replace(
              'require("./msal-node-runtime")',
              'require(process.env.XMCL_MSAL_NODE_RUNTIME_PATH || "./msal-node-runtime")',
            ),
            loader: 'js',
          }
        },
      )

      // undici ships its llhttp parser as two base64-encoded wasm modules
      // (`llhttp-wasm.js` + `llhttp_simd-wasm.js`, ~70KB base64 each). Both are
      // statically `require`d by client-h1.js, so esbuild inlines BOTH into
      // every bundle that pulls in undici — decode each once at build time,
      // write it as a single shared `.wasm` directly into the output dir, and
      // read it from disk at runtime, to avoid duplicating ~840KB across
      // bundles.
      build.onLoad(
        { filter: /undici[\\/]lib[\\/]llhttp[\\/]llhttp(_simd)?-wasm\.js$/ },
        async ({ path }) => {
          const content = await readFile(path, 'utf-8')
          const match = content.match(/wasmBase64\s*=\s*'([A-Za-z0-9+/=]+)'/)
          if (!match) {
            // Format changed upstream; fall back to the original inlined module.
            return { contents: content, loader: 'js' }
          }
          // Write the decoded wasm straight into esbuild's output dir instead of
          // routing it through esbuild's `file` loader. The file loader resolves
          // an absolute path we create *during* the build, but esbuild caches a
          // negative stat for that path when it first scans (the file does not
          // exist yet on a clean checkout), so on CI the later `require(wasmFile)`
          // intermittently fails with "Could not resolve …llhttp-wasm.wasm".
          // Referencing the file only through a runtime `path.join(__dirname, …)`
          // (a plain string, never a `require`/`import` specifier) keeps esbuild
          // out of the resolution entirely — mirroring the iconv-lite stub below.
          const outDir = build.initialOptions.outdir!
          const wasmName = basename(path).replace(/\.js$/, '.wasm')
          const wasmFile = join(outDir, wasmName)
          let ensure = wasmShared.get(wasmFile)
          if (!ensure) {
            ensure = createOnceCache()
            wasmShared.set(wasmFile, ensure)
          }
          await ensure(wasmFile, () => mkdir(outDir, { recursive: true })
            .then(() => writeFile(wasmFile, Buffer.from(match[1], 'base64'))))
          return {
            contents: `'use strict'
const { readFileSync, existsSync } = require('node:fs')
const { join, resolve } = require('node:path')
let wasmBuffer
function findFile(name) {
  let dir = __dirname
  while (dir) {
    const candidate = join(dir, name)
    if (existsSync(candidate)) return candidate
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return join(__dirname, name)
}
Object.defineProperty(module, 'exports', {
  get: () => wasmBuffer || (wasmBuffer = readFileSync(findFile(${JSON.stringify(wasmName)})))
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
          const outFile = join(outDir, 'iconv-lite.js')
          await iconvShared(outFile, () => esbuild({
            bundle: true,
            platform: 'node',
            format: 'cjs',
            target: 'es2020',
            entryPoints: [path],
            outfile: outFile,
            minifyWhitespace: build.initialOptions.minifyWhitespace,
            minifySyntax: build.initialOptions.minifySyntax,
            keepNames: true,
          }))
          return {
            contents: `'use strict'
const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')
function findFile(name) {
  let dir = __dirname
  while (dir) {
    const candidate = join(dir, name)
    if (existsSync(candidate)) return candidate
    const parent = resolve(dir, '..')
    if (parent === dir) break

    dir = parent
  }
  return join(__dirname, name)
}
module.exports = require(findFile('iconv-lite.js'))`,
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
