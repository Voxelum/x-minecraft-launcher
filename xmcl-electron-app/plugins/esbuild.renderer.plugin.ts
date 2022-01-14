import { basename } from 'path'
import { cleanUrl } from './util'
import { Plugin } from 'esbuild'

/**
 * Resolve import starts with `/@renderer` and ends with `.html` extension to the real file url.
 */
export default function createRendererPlugin(): Plugin {
  return {
    name: 'resolve-renderer',
    setup(build) {
      build.onResolve({ filter: /@renderer\/.+/g }, async ({ path }) => ({ path: basename(path) + '?renderer', namespace: 'renderer' }))
      build.onLoad({ filter: /^.+\?renderer$/g, namespace: 'renderer' }, async ({ path }) => {
        const clean = cleanUrl(path)
        const outDir = build.initialOptions.outdir
        return {
          contents:
          build.initialOptions.watch
            ? `export default "http://localhost:3000/${basename(clean)}"`
            : `import { join } from 'path'; import { pathToFileURL } from 'url'; export default pathToFileURL(join(__dirname, 'renderer', ${JSON.stringify(clean)})).toString();`,
          resolveDir: outDir,
        }
      })
    },
  }
}
