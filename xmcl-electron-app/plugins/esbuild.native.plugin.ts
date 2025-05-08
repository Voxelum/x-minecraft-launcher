import { Plugin } from 'esbuild'
import { existsSync } from 'fs'
import { readdir, readFile, link, unlink, stat } from 'fs/promises'
import { arch, platform } from 'os'
import { dirname, join, relative } from 'path'

/**
 * Correctly handle native node import.
 */
export default function createNativeModulePlugin(nodeModules: string): Plugin {
  return {
    name: 'resolve-native-module',
    setup(build) {
      const isDev = build.initialOptions.plugins!.find(v => v.name === 'dev')
      if (isDev) {
        build.onLoad(
          { filter: /^.+[\\/]node_modules[\\/].+[\\/]default-gateway[\\/]index\.js$/g },
          async ({ path }) => {
            const content = await readFile(path, 'utf-8')
            const plat = platform()
            return {
              contents: content.replace(/`\.\/\${file}\.js`/g, JSON.stringify(join(dirname(path), `${plat}.js`))),
              loader: 'js',
            }
          },
        )
      }

      build.onLoad(
        { filter: /^.+node-sqlite3-wasm[\\/]dist[\\/]node-sqlite3-wasm\.js$/g },
        async ({ path }) => {
          let content = (await readFile(path, 'utf-8'))
          content = content.replace('get isFinalized(){return this._ptr===null}',
            'get isFinalized(){return this._ptr===null}' +
            'isReader(){return sqlite3.column_count(this._ptr)>=1}',
          )
          if (isDev) {
            content = content.replace('"node-sqlite3-wasm.wasm"', 'require("./node-sqlite3-wasm.wasm")')
          } else {
            const dir = dirname(path)
            const wasmPath = join(dir, 'node-sqlite3-wasm.wasm')
            const base64WasmContent = await readFile(wasmPath, 'base64')
            content = content.replace('function getBinarySync(file){',
              'function getBinarySync(file){' + `return Buffer.from(${JSON.stringify(base64WasmContent)}, 'base64');`,
            )
          }
          return {
            contents: content,
            loader: 'js',
          }
        },
      )

      // Intercept node_modules\cpu-features\lib\index.js
      build.onLoad(
        { filter: /^.+cpu-features[\\/]lib[\\/]index\.js$/g },
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
        { filter: /^.+png2icons[\\/]lib[\\/]UPNG\.js$/g },
        async ({ path }) => {
          let content = await readFile(path, 'utf-8')
          content = content.replace(`if (typeof require == "function") {UZIP = require("./UZIP");}  else {UZIP = window.UZIP;}`, 'let UZIP = require("./UZIP");')
          return {
            contents: content,
            loader: 'js',
          }
        }
      )

      // node_modules\.pnpm\yauzl@2.10.0\node_modules\yauzl\index.js
      build.onLoad(
        { filter: /^.+yauzl[\\/]index\.js$/g },
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
        { filter: /^.+node-datachannel[\\/]dist[\\/]esm[\\/]polyfill[\\/]RTCPeerConnection\.mjs$/g },
        async ({ path }) => {
          let content = (await
            readFile(path, 'utf-8'))

          // replace `constructor(init = {}) {` to `constructor(init = {}, PeerConnection) {`
          content = content.replace('constructor(config = { iceServers: [], iceTransportPolicy: "all" }) {', 'constructor(config = { iceServers: [], iceTransportPolicy: "all" }, PeerConnection) {')
          // remove the line `import { PeerConnection } from '../lib/index.mjs';`
          content = content.replace(/import { PeerConnection } from '..\/lib\/index.mjs';/g, '')

          return {
            contents: content,
            loader: 'js',
          }
        },
      )

      // Intercept node_modules\node-datachannel\dist\esm\lib\node-datachannel.mjs
      build.onLoad(
        { filter: /^.+node-datachannel[\\/]dist[\\/]esm[\\/]lib[\\/]node-datachannel\.mjs$/g },
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
        { filter: /^.+node-datachannel[\\/]dist[\\/]esm[\\/]lib[\\/]node-datachannel\.mjs$/g },
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
