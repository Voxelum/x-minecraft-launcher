import { Plugin, build as esbuild } from 'esbuild'
import { relative, dirname, join } from 'path'
import { cleanUrl } from './util'
/**
 * Resolve the import of preload and emit it as single chunk of js file in rollup.
 */
export default function createPreloadPlugin(preloadSrc: string): Plugin {
  return {
    name: 'resolve-preload',
    setup(build) {
      build.onResolve({ filter: /@preload\/.+/g }, async ({ path }) => ({
        path:
          path.replace('@preload', preloadSrc) +
          '?preload',
      }))
      build.onLoad({ filter: /^.+\?preload$/g }, async ({ path }) => {
        const absoltePath = cleanUrl(path)
        const result = await esbuild({
          bundle: true,
          metafile: true,
          entryNames: '[dir]/[name]-preload',
          entryPoints: [absoltePath],
          treeShaking: true,
          write: true,
          outdir: build.initialOptions.outdir,
          absWorkingDir: build.initialOptions.outdir,
          platform: 'node',
          external: build.initialOptions.external,
          sourceRoot: build.initialOptions.sourceRoot,
          sourcemap: build.initialOptions.sourcemap,
          format: build.initialOptions.format,
        })
        const resultFile = Object.keys(result.metafile?.outputs || {}).filter(v => v.endsWith('.js'))[0]
        const watching = Object.keys(result.metafile?.inputs || {})
        return {
          errors: result.errors,
          warnings: result.warnings,
          contents: build.initialOptions.watch
            ? `export default ${JSON.stringify(join(build.initialOptions.outdir!, resultFile))}`
            : `import { join } from 'path'; export default join(__dirname, ${JSON.stringify(resultFile)})`,
          watchFiles: build.initialOptions.watch ? watching : undefined,
        }
      })
    },
  }
}
