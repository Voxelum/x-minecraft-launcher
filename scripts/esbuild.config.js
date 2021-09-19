const path = require('path')
const pluginPreload = require('./plugins/esbuild.preload.plugin')
const pluginRenedrer = require('./plugins/esbuild.renderer.plugin')
const pluginStatic = require('./plugins/esbuild.static.plugin')
const pluginWorker = require('./plugins/esbuild.worker.plugin')
const pluginVueDevtools = require('./plugins/esbuild.devtool.plugin')
const pluginNode = require('./plugins/esbuild.node.plugin')
const { external } = require('../package.json')

/**
 * @type {import('esbuild').BuildOptions}
 */
const config = {
  bundle: true,
  metafile: true,
  assetNames: 'static/[name]-[hash]',
  entryNames: '[dir]/[name]',
  format: 'cjs',
  outdir: path.join(__dirname, '../dist'),
  sourcemap: 'inline',
  // sourceRoot: path.join(__dirname, '../src'),
  platform: 'node',
  loader: {
    '.png': 'file',
    '.jpeg': 'file',
    '.jpg': 'file',
    '.svg': 'file',
    '.webp': 'file',
    '.cs': 'file'
  },
  plugins: [
    pluginPreload(path.join(__dirname, '../src/preload')),
    pluginRenedrer(),
    pluginStatic(path.join(__dirname, '../static')),
    pluginVueDevtools(path.join(__dirname, '../extensions')),
    pluginWorker(),
    pluginNode()
  ],
  external: ['electron', ...external]
}

module.exports = config
