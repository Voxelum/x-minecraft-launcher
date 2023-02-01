import { Plugin } from 'esbuild'
import { existsSync, readdir, readdirSync, readFile } from 'fs-extra'
import { arch, platform } from 'os'
import { dirname, join, relative, resolve } from 'path'

/**
 * Correctly handle native node import.
 */
export default function createNativeModulePlugin(nodeModules: string): Plugin {
  return {
    name: 'resolve-native-module',
    setup(build) {
      if (build.initialOptions.watch) {
        build.onLoad(
          { filter: /^.+[\\/]node_modules[\\/].+[\\/]7zip-bin[\\/]index\.js$/g },
          async ({ path }) => {
            const content = await readFile(path, 'utf-8')
            return {
              contents: content.replace(/__dirname/g, JSON.stringify(join(nodeModules, '7zip-bin'))),
              loader: 'js',
            }
          },
        )

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
      // Remove the side effect of classic-level to avoid it's bundled in worker script
      // build.onResolve({ filter: /classic-level/g }, async ({ path, resolveDir }) => ({
      //   path: require.resolve(path, {
      //     paths: [resolveDir],
      //   }),
      //   sideEffects: false,
      // }))
      // return empty js for sharp to prevent it include large binary
      build.onLoad(
        { filter: /^.+[\\/]node_modules[\\/].+[\\/]sharp[\\/]lib[\\/]index\.js$/g },
        async ({ path }) => {
          return {
            contents: 'module.exports = {}',
            loader: 'js',
          }
        },
      )
      // replace sharp
      build.onLoad(
        { filter: /^.+[\\/]node_modules[\\/].+[\\/]sharp[\\/]lib[\\/]sharp\.js$/g },
        async ({ path }) => {
          // sharp is only for svg
          throw new Error('This should not be reach!')
          // const content = await readFile(path, 'utf-8')
          // const modulePath = join(path, '../platform.js')
          // // eslint-disable-next-line @typescript-eslint/no-var-requires
          // const platform = require(modulePath)()
          // const contents = content.replace(/\$\{platformAndArch\}/g, platform)
          // // if (!build.initialOptions.watch) {
          // //   const allLibs = (await readdir(join(dirname(path), '../build/Release'))).filter(f => f.endsWith('.dll') || f.endsWith('.so'))
          // //     .map((f) => `require("../build/Release/${f}")`)
          // //   contents = `${allLibs.join('\n')}
          // //   ${contents}`
          // // }
          // return {
          //   contents: contents,
          //   loader: 'js',
          //   resolveDir: dirname(path),
          // }
        },
      )

      build.onResolve(
        { filter: /^.+[\\/]node_modules[\\/].+[\\/]classic-level[\\/]binding\.js$/g },
        async ({ path, resolveDir }) => {
          return {
            path: path,
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
          const tuples = readdirSync(join(dir, 'prebuilds')).map(parseTuple)
          const tuple = tuples.filter(matchTuple(platform8, arch3)).sort(compareTuples)[0]
          if (!tuple) throw new Error()
          const prebuilds = join(dir, 'prebuilds', tuple.name)
          const parsed = readdirSync(prebuilds).map(parseTags)
          const candidates = parsed.filter(matchTags(runtime, abi))
          const winner = candidates.sort(compareTags(runtime))[0]
          if (!winner) throw new Error()
          const targetPath = join(prebuilds, winner.file)
          const relativePath = './' + relative(dir, targetPath).replace(/\\/g, '/')
          return {
            contents: `module.exports = require(${JSON.stringify(relativePath)})`,
            resolveDir: dir,
          }
        },
      )

      if (!build.initialOptions.watch) {
        const opts = build.initialOptions
        opts.loader = opts.loader || {}
        opts.loader['.dll'] = 'file'
        opts.loader['.so'] = 'file'
      }
    },
  }
}
