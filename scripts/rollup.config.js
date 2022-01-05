import pluginAlias from '@rollup/plugin-alias'
import pluginCommonJs from '@rollup/plugin-commonjs'
import pluginJson from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import builtins from 'builtin-modules'
import chalk from 'chalk'
import { join } from 'path'
import { external } from '../package.json'
import pluginEsbuild from './plugins/rollup.esbuild.plugin'
import pluginResolve from './plugins/rollup.assets.plugin'
import pluginPreload from './plugins/rollup.preload.plugin'
import pluginRenedrer from './plugins/rollup.renderer.plugin'
import pluginStatic from './plugins/rollup.static.plugin'
import pluginTypescript from './plugins/rollup.typescript.plugin'
import pluginWorker from './plugins/rollup.worker.plugin'

/**
 * @type {import('rollup').RollupOptions[]}
 */
const config = [{
  // this is the rollup config of main process
  output: {
    dir: join(__dirname, '../dist'),
    format: 'cjs',
    sourcemap: process.env.NODE_ENV === 'development' ? true : false
  },
  onwarn: (warning) => {
    if (warning.plugin === 'typescript:checker') {
      console.log(chalk.yellow(warning.message))
    } else {
      console.log(`Plugin: ${warning.plugin}`)
      console.log(chalk.yellow(warning.toString()))
    }
  },
  external: [...builtins, 'electron'],
  plugins: [
    pluginAlias({
      entries: {
        '/@main': join(__dirname, '../src/main'),
        '/@shared': join(__dirname, '../src/shared')
      }
    }),
    pluginStatic(),
    pluginRenedrer(),
    pluginPreload(),
    pluginWorker(),
    nodeResolve({
      browser: false
    }),
    pluginCommonJs({
      extensions: ['.js', '.cjs']
    }),
    pluginTypescript({
      tsconfig: [join(__dirname, '../src/main/tsconfig.json'), join(__dirname, '../src/preload/tsconfig.json')]
    }),
    pluginResolve(),
    pluginEsbuild(),
    pluginJson({
      preferConst: true,
      indent: '  ',
      compact: false,
      namedExports: true
    }),
  ]
}]

export default config
