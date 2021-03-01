import chalk from 'chalk'
import { startService } from 'esbuild'
import { extname } from 'path'

/**
 * Wrap esbuild to rollup plugin to build typescript
 * @type {() => import('rollup').Plugin}
 */
const createPlugin = () => {
  return ({
    name: 'main:esbuild',
    async buildStart() {
      this.cache.set('service', await startService())
    },
    async resolveId(id, importer) {
      if (id.endsWith('.ts')) {
        return
      }
      const tsResult = await this.resolve(`${id}.ts`, importer, { skipSelf: true })
      if (tsResult) {
        return tsResult
      }
      const indexTsResult = await this.resolve(`${id}/index.ts`, importer, { skipSelf: true })
      if (indexTsResult) {
        return indexTsResult
      }
    },
    async transform(code, id) {
      if (id.endsWith('js') || id.endsWith('js?commonjs-proxy')) {
        return
      }
      if (!id.endsWith('.ts')) {
        return
      }
      function printMessage(m, code) {
        console.error(chalk.yellow(m.text))
        if (m.location) {
          const lines = code.split(/\r?\n/g)
          const line = Number(m.location.line)
          const column = Number(m.location.column)
          const offset =
            lines
              .slice(0, line - 1)
              .map((l) => l.length)
              .reduce((total, l) => total + l + 1, 0) + column
          console.error(
            require('@vue/compiler-dom').generateCodeFrame(code, offset, offset + 1)
          )
        }
      }
      try {
        /**
         * @type {import('esbuild').Service}
         */
        const service = this.cache.get('service')
        const result = await service.transform(code, {
          // @ts-ignore
          loader: extname(id).slice(1),
          sourcemap: true,
          sourcefile: id,
          target: 'es2020'
        })
        if (result.warnings.length) {
          console.error(`[main] warnings while transforming ${id} with esbuild:`)
          result.warnings.forEach((m) => printMessage(m, code))
        }
        return {
          code: result.code,
          map: result.map
        }
      } catch (e) {
        console.error(
          chalk.red(`[main] error while transforming ${id} with esbuild:`)
        )
        if (e.errors) {
          e.errors.forEach((m) => printMessage(m, code))
        } else {
          console.error(e)
        }
        return {
          code: '',
          map: undefined
        }
      }
    },
    buildEnd(error) {
      // Stop the service early if there's error
      if (error && !this.meta.watchMode) {
        this.cache.get('service').stop()
        console.log('esbuild service stop!')
      }
    },
    generateBundle() {
      if (!this.meta.watchMode) {
        this.cache.get('service').stop()
        console.log('esbuild service stop!')
      }
    }
  })
}

export default createPlugin
