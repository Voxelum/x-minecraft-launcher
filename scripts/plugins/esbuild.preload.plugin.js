const { build: esbuild } = require('esbuild')
const { relative, dirname, join } = require('path')
const { cleanUrl } = require('./util')
/**
 * Resolve the import of preload and emit it as single chunk of js file in rollup.
 * @param {string} preloadSrc
 * @returns {import('esbuild').Plugin}
 */
module.exports = function createPreloadPlugin(preloadSrc) {
  return {
    name: 'resolve-preload',
    setup(build) {
      build.onResolve({ filter: /@preload\/.+/g }, async ({ path }) => ({
        path:
          path.replace('/@preload', preloadSrc) +
          '?preload'
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
          platform: 'node',
          external: build.initialOptions.external,
          sourceRoot: build.initialOptions.sourceRoot,
          sourcemap: 'inline',
          format: build.initialOptions.format
        })
        const resultFile = Object.keys(result.metafile?.outputs || {})[0]
        const relativePath = relative('dist', resultFile)
        const watching = Object.keys(result.metafile?.inputs || {})
        const outFile = join(dirname(build.initialOptions.outdir || ''), Object.keys(result.metafile?.outputs || {}).filter(f => f.endsWith('.js'))[0])
        return {
          errors: result.errors,
          warnings: result.warnings,
          contents: build.initialOptions.watch
            ? `export default ${JSON.stringify(outFile)}`
            : `import { join } from 'path'; export default join(__dirname, ${JSON.stringify(relativePath)})`,
          watchFiles: build.initialOptions.watch ? watching : undefined
        }
      })
    }
  }
}
