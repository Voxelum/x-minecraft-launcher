import { Plugin } from 'esbuild'
import { readFile } from 'fs-extra'
import { platform } from 'os'
import { dirname, join } from 'path'

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

      if (!build.initialOptions.watch) {
        const opts = build.initialOptions
        opts.loader = opts.loader || {}
        opts.loader['.dll'] = 'file'
        opts.loader['.so'] = 'file'
      }
    },
  }
}
