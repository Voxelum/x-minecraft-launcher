import { build as esbuild, Plugin } from 'esbuild'
import { basename, join, resolve } from 'path'
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
          assetNames: '[name]',
          entryPoints: [absoltePath],
          treeShaking: true,
          write: true,
          outdir: outDir,
          sourcemap: build.initialOptions.sourcemap,
          minifyWhitespace: build.initialOptions.minifyWhitespace,
          minifySyntax: build.initialOptions.minifySyntax,
          keepNames: true,
          platform: 'node',
          plugins: build.initialOptions.plugins,
        })
        const fileName = basename((Object.keys(result.metafile?.outputs || {}).filter(v => v.endsWith('.js')))[0])
        return {
          errors: result.errors,
          warnings: result.warnings,
          contents: build.initialOptions.watch
            ? `
          import { Worker } from 'worker_threads';
          export const path = ${JSON.stringify(join(outDir, fileName))};
          export default function (options) { return new Worker(path, options); }`
            : `
          import { join, dirname } from 'path';
          import { Worker } from 'worker_threads';
          export const path = join(__dirname.replace("app.asar", "app.asar.unpacked"), ${JSON.stringify(fileName)});
          export default function (options) { return new Worker(path, options); }`,
          resolveDir: outDir,
        }
      })
    },
  }
}
