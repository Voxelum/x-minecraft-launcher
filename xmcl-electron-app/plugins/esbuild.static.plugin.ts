import { Plugin } from 'esbuild'
import { readFile } from 'fs/promises'
import { join } from 'path'
/**
 * Resolve the import of preload and emit it as single chunk of js file in rollup.
 */
export default function createStaticPlugin(): Plugin {
  return {
    name: 'resolve-static',
    setup(build) {
      if (!build.initialOptions.watch) {
        build.onResolve({ filter: /^.+\?static$/g }, async ({ path, resolveDir }) => {
          return ({
            path: path.substring(0, path.length - '.static'.length),
            pluginData: { resolveDir },
            namespace: 'static'
          })
        })
        build.onLoad({ filter: /^.+$/g, namespace: 'static' }, async ({ path, pluginData: { resolveDir } }) => {
          return ({
            contents: await readFile(path),
            resolveDir: resolveDir,
            loader: 'file'
          })
        })
        build.onResolve({ filter: /^.+\.png$/g }, async ({ path, resolveDir }) => {
          return ({
            path: path + '?static',
            namespace: 'pre-static',
            pluginData: { resolveDir }
          })
        })
        build.onLoad({ filter: /^.+\?static$/g, namespace: 'pre-static' }, async ({ path, pluginData: { resolveDir } }) => {
          return {
            contents: `import path from 'path'; import filePath from ${JSON.stringify(join(resolveDir, path))}; export default path.join(__dirname, filePath);`,
            resolveDir,
          }
        })
      }
    },
  }
}
