import path from 'path'
import pluginPreload from './plugins/esbuild.preload.plugin'
import pluginRenderer from './plugins/esbuild.renderer.plugin'
import pluginWorker from './plugins/esbuild.worker.plugin'
import pluginVueDevtools from './plugins/esbuild.devtool.plugin'
import pluginNode from './plugins/esbuild.node.plugin'
import plugin7Zip from './plugins/esbuild.7zipbin.plugin'
// import { external } from './package.json'
import { BuildOptions } from 'esbuild'

const config: BuildOptions = {
  bundle: true,
  metafile: true,
  assetNames: 'assets/[name]-[hash]',
  entryNames: '[dir]/[name]',
  format: 'cjs',
  sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  minify: process.env.NODE_ENV === 'production',
  platform: 'node',
  loader: {
    '.png': 'file',
    '.jpeg': 'file',
    '.jpg': 'file',
    '.svg': 'file',
    '.webp': 'file',
    '.cs': 'file',
  },
  plugins: [
    pluginPreload(path.resolve(__dirname, './preload')),
    pluginRenderer(),
    pluginVueDevtools(path.resolve(__dirname, '../extensions')),
    pluginWorker(),
    plugin7Zip(path.resolve(__dirname, './node_modules')),
    pluginNode(),
  ],
  external: ['electron', ...[]],
}

export default config
