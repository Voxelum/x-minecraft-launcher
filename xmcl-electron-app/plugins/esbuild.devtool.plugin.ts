import { Plugin } from 'esbuild'

/**
 * Provide vue-devtool extension virtual import.
 * @param {string} extensionLocation
 * @returns {import('esbuild').Plugin}
 */
export default function createVueDevtoolsPlugin(extensionLocation: string): Plugin {
  return {
    name: 'resolve-devtools',
    setup(build) {
      if (build.initialOptions.watch) {
        build.onResolve({ filter: /vue-devtools/g }, async ({ path }) => ({
          path,
          namespace: 'devtools',
        }))
        build.onLoad({ filter: /vue-devtools/g, namespace: 'devtools' }, async () => {
          return {
            contents: `export default ${JSON.stringify(extensionLocation)}`,
            resolveDir: build.initialOptions.outdir,
          }
        })
      }
    },
  }
}
