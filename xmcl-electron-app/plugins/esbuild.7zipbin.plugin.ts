import { dirname, join } from 'path'
import { Plugin } from 'esbuild'
import { readFile } from 'fs-extra'
import { platform } from 'os'

const nodeModules = new RegExp(/^.+[\\\/]node_modules[\\\/].+[\\\/]7zip-bin[\\\/]index\.js$/)

/**
 * Correctly handle 7za bin import.
 */
export default function create7ZipBinPlugin(nodeModules: string): Plugin {
  return {
    name: 'resolve-7zip-bin',
    setup(build) {
      if (build.initialOptions.watch) {
        build.onLoad(
          { filter: /^.+[\\\/]node_modules[\\\/].+[\\\/]7zip-bin[\\\/]index\.js$/g },
          async ({ path }) => {
            const content = await readFile(path, 'utf-8')
            return {
              contents: content.replace(/__dirname/g, JSON.stringify(join(nodeModules, '7zip-bin'))),
              loader: 'js',
            }
          },
        )
        build.onLoad(
          { filter: /^.+[\\\/]node_modules[\\\/].+[\\\/]default-gateway[\\\/]index\.js$/g },
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
    },
  }
}
