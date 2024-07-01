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

      // Intercept node_modules\node-datachannel\polyfill\RTCPeerConnection.js
      build.onLoad(
        { filter: /^.+node-datachannel[\\/]polyfill[\\/]RTCPeerConnection\.js$/g },
        async ({ path }) => {
          let content = (await
            readFile(path, 'utf-8'))

          // replace `constructor(init = {}) {` to `constructor(init = {}, NodeDataChannel) {`
          content = content.replace('constructor(init = {}) {', 'constructor(init = {}, NodeDataChannel) {')
          // remove the line `import NodeDataChannel from '../lib/index.js';`
          content = content.replace(/import NodeDataChannel from '..\/lib\/index.js';/g, '')

          content = content.replace('const [protocol, rest] = url.split(/:(.*)/);',
            "const [protocol, hostname, port] = url.split(':');" +
            'return { hostname, port, username: server.username, password: server.credential };\n',
          )

          return {
            contents: content,
            loader: 'js',
          }
        },
      )

      // Intercept node_modules\node-datachannel\lib\index.js
      build.onLoad(
        { filter: /^.+node-datachannel[\\/]lib[\\/]index\.c?js$/g },
        async ({ path }) => {
          return {
            contents: `
            export {Audio,DataChannel,DescriptionType,PeerConnection,cleanup,initLogger,preload,setSctpSettings,RelayType,ReliabilityType,RtcpReceivingSession,Track,Video,Direction} from '../build/Release/node_datachannel.node';
            export { default as DataChannelStream } from './datachannel-stream.js';
            `,
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
