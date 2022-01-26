import { build as esbuild, Plugin } from 'esbuild'
import { join, resolve } from 'path'
import { cleanUrl } from './util'

/**
 * Resolve ?worker import to the function creating the worker object
 */
export default function createWorkerPlugin(): Plugin {
  return {
    name: 'resolve-worker',
    setup(build) {
      build.onResolve({ filter: /^.+\?worker$/g }, async ({ path, resolveDir }) => ({
        path: resolve(resolveDir, path),
        namespace: 'worker',
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
          entryNames: '[dir]/[name].worker',
          entryPoints: [absoltePath],
          treeShaking: true,
          write: true,
          absWorkingDir: outDir,
          outdir: outDir,
          sourcemap: build.initialOptions.watch ? 'inline' : false,
          platform: 'node',
        })
        const fileName = (Object.keys(result.metafile?.outputs || {})[0])
        return {
          errors: result.errors,
          warnings: result.warnings,
          contents: build.initialOptions.watch
            ? `
          import { Worker } from 'worker_threads';
          export default function (options) { return new Worker(${JSON.stringify(join(outDir, fileName))}, options); }`
            : `
          import { join, dirname } from 'path';
          import { Worker } from 'worker_threads';
          export default function (options) { return new Worker(join(__dirname.replace("app.asar", "app.asar.unpacked"), ${JSON.stringify(fileName)}), options); }`,
          resolveDir: outDir,
        }
      })
    },
  }
}
