const { join, dirname } = require('path')
const { cleanUrl } = require('./util.js')
const { build: esbuild } = require('esbuild')

/**
 * Resolve ?worker import to the function creating the worker object
 * @returns {import('esbuild').Plugin}
 */
module.exports = function createWorkerPlugin() {
  return {
    name: 'resolve-worker',
    setup(build) {
      build.onResolve({ filter: /^.+\?worker$/g }, async ({ path, resolveDir }) => ({
        path: join(resolveDir, path),
        namespace: 'worker'
      }))
      build.onLoad({ filter: /^.+\?worker$/g, namespace: 'worker' }, async ({ path }) => {
        let absoltePath = cleanUrl(path)
        absoltePath = !absoltePath.endsWith('.ts') ? absoltePath + '.ts' : absoltePath
        const outDir = build.initialOptions.outdir
        if (!outDir) {
          throw new Error()
        }
        const result = await esbuild({
          bundle: true,
          metafile: true,
          entryNames: '[dir]/[name]-worker',
          entryPoints: [absoltePath],
          treeShaking: true,
          write: true,
          outdir: outDir,
          platform: 'node'
        })
        const outFile = join(dirname(outDir), Object.keys(result.metafile?.outputs || {})[0])
        return {
          errors: result.errors,
          warnings: result.warnings,
          contents: build.initialOptions.watch
            ? `
          import { Worker } from 'worker_threads';
          export default function (options) { return new Worker(${JSON.stringify(outFile)}, options); }`
            : `
          import { join } from 'path';
          import { Worker } from 'worker_threads';
          export default function (options) { return new Worker(join(__dirname, ${JSON.stringify(outFile)}), options); }`,
          resolveDir: outDir
        }
      })
    }
  }
}
