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

      // Intercept node_modules\better-sqlite3\lib\database.js
      build.onLoad(
        { filter: /^.+better-sqlite3[\\/]lib[\\/]database\.js$/g },
        async ({ path }) => {
          const content = (await readFile(path, 'utf-8')).replace(/require\('bindings'\)\('better_sqlite3\.node'\)/g, 'require(\'../build/Release/better_sqlite3.node\')')
          return {
            contents: content,
            loader: 'js',
          }
        },
      )

      // Intercept node_modules\node-datachannel\lib\index.js
      build.onLoad(
        { filter: /^.+node-datachannel[\\/]lib[\\/]index\.js$/g },
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

      // node_modules\.pnpm\undici@6.11.1\node_modules\undici\lib\dispatcher\client.js
      build.onLoad(
        { filter: /^.+[\\/]undici[\\/]lib[\\/]dispatcher[\\/]client\.js$/g },
        async ({ path }) => {
          const content = await readFile(path, 'utf-8')
          return {
            contents: content.replace('client[kHTTPContext]?.destroy(new InformationalError(\'servername changed\'))', 'client[kHTTPContext]?.destroy(new InformationalError(\'servername changed\'), () => {})'),
            loader: 'js',
          }
        },
      )

      build.onResolve(
        { filter: /^.+[\\/]node_modules[\\/].+[\\/]classic-level[\\/]binding\.js$/g },
        async ({ path, resolveDir }) => {
          return {
            path,
            pluginData: {
              resolveDir,
            },
          }
        },
      )
      build.onLoad(
        { filter: /^.+[\\/]node_modules[\\/].+[\\/]classic-level[\\/]binding\.js$/g },
        async ({ path }) => {
          type Tuple = ReturnType<typeof parseTuple>
          function matchTuple(platform9: string, arch4: string) {
            return function (tuple: Tuple) {
              if (tuple == null) { return false }
              if (tuple.platform !== platform9) { return false }
              return tuple.architectures.includes(arch4)
            }
          }
          function parseTuple(name: string) {
            const arr = name.split('-')
            if (arr.length !== 2) { return }
            const platform9 = arr[0]
            const architectures = arr[1].split('+')
            if (!platform9) { return }
            if (!architectures.length) { return }
            if (!architectures.every(Boolean)) { return }
            return { name, platform: platform9, architectures }
          }
          function compareTuples(a: any, b: any) {
            return a.architectures.length - b.architectures.length
          }
          function parseTags(file: string) {
            const arr = file.split('.')
            const extension = arr.pop()
            const tags: any = { file, specificity: 0 }
            if (extension !== 'node') { return }
            for (let i = 0; i < arr.length; i++) {
              const tag = arr[i]
              if (tag === 'node' || tag === 'electron' || tag === 'node-webkit') {
                tags.runtime = tag
              } else if (tag === 'napi') {
                tags.napi = true
              } else if (tag.slice(0, 3) === 'abi') {
                tags.abi = tag.slice(3)
              } else if (tag.slice(0, 2) === 'uv') {
                tags.uv = tag.slice(2)
              } else if (tag.slice(0, 4) === 'armv') {
                tags.armv = tag.slice(4)
              } else if (tag === 'glibc' || tag === 'musl') {
                tags.libc = tag
              } else {
                continue
              }
              tags.specificity++
            }
            return tags
          }
          function matchTags(runtime2: any, abi2: any) {
            function runtimeAgnostic(tags: any) {
              return tags.runtime === 'node' && tags.napi
            }
            return function (tags: any) {
              if (tags == null) { return false }
              if (tags.runtime !== runtime2 && !runtimeAgnostic(tags)) { return false }
              if (tags.abi !== abi2 && !tags.napi) { return false }
              if (tags.uv && tags.uv !== uv) { return false }
              if (tags.armv && tags.armv !== armv) { return false }
              if (tags.libc && tags.libc !== libc) { return false }
              return true
            }
          }
          function compareTags(runtime2: any) {
            return function (a: any, b: any) {
              if (a.runtime !== b.runtime) {
                return a.runtime === runtime2 ? -1 : 1
              } else if (a.abi !== b.abi) {
                return a.abi ? -1 : 1
              } else if (a.specificity !== b.specificity) {
                return a.specificity > b.specificity ? -1 : 1
              } else {
                return 0
              }
            }
          }
          function isAlpine(platform9: any) {
            return platform9 === 'linux' && existsSync('/etc/alpine-release')
          }
          const abi = process.versions.modules
          const runtime = 'electron'
          const arch3 = arch()
          const platform8 = platform()

          const libc = process.env.LIBC || (isAlpine(platform8) ? 'musl' : 'glibc')
          const vars = process.config && (process.config.variables || {}) as any
          const armv = process.env.ARM_VERSION || (arch3 === 'arm64' ? '8' : vars.arm_version) || ''
          const uv = (process.versions.uv || '').split('.')[0]
          const dir = dirname(path)
          const tuples = (await readdir(join(dir, 'prebuilds'))).map(parseTuple)
          const tuple = tuples.filter(matchTuple(platform8, arch3)).sort(compareTuples)[0]
          if (!tuple) throw new Error()
          const prebuilds = join(dir, 'prebuilds', tuple.name)
          const parsed = (await readdir(prebuilds)).map(parseTags)
          const candidates = parsed.filter(matchTags(runtime, abi))
          const winner = candidates.sort(compareTags(runtime))[0]
          if (!winner) throw new Error()
          const targetPath = join(prebuilds, winner.file)
          const linkedPath = join(dir, 'classic-level.node')
          if (existsSync(linkedPath)) {
            const s = await stat(linkedPath)
            const d = await stat(targetPath)
            if (s.ino !== d.ino) {
              await unlink(linkedPath)
              await link(targetPath, linkedPath)
            }
          } else {
            await link(targetPath, linkedPath)
          }
          const relativePath = './' + relative(dir, linkedPath).replace(/\\/g, '/')
          return {
            contents: `module.exports = require(${JSON.stringify(relativePath)})`,
            resolveDir: dir,
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
