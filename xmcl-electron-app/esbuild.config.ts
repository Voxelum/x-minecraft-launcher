import path from 'path'
import pluginPreload from './plugins/esbuild.preload.plugin'
import pluginRenderer from './plugins/esbuild.renderer.plugin'
import pluginWorker from './plugins/esbuild.worker.plugin'
import pluginVueDevtools from './plugins/esbuild.devtool.plugin'
import pluginNode from './plugins/esbuild.node.plugin'
import plugin7Zip from './plugins/esbuild.native.plugin'
import pluginStatic from './plugins/esbuild.static.plugin'
import { yamlPlugin } from 'esbuild-plugin-yaml'
import { BuildOptions } from 'esbuild'
import 'dotenv/config'

const config: BuildOptions = {
  bundle: true,
  metafile: true,
  assetNames: '[name]',
  entryNames: '[dir]/[name]',
  format: 'cjs',
  sourcemap: process.env.NODE_ENV === 'production' ? false : 'linked',
  minifyWhitespace: process.env.NODE_ENV === 'production',
  minifySyntax: process.env.NODE_ENV === 'production',
  treeShaking: true,
  keepNames: true,
  define: {
    'process.env.BUILD_TARGET': JSON.stringify(process.env.BUILD_TARGET) ?? '""',
    'process.env.BUILD_NUMBER': JSON.stringify(process.env.BUILD_NUMBER) ?? '10',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV) ?? '"development"',
    'process.env.CURSEFORGE_API_KEY': JSON.stringify(process.env.CURSEFORGE_API_KEY),
  },
  platform: 'node',
  loader: {
    '.png': 'file',
    '.jpeg': 'file',
    '.jpg': 'file',
    '.svg': 'file',
    '.webp': 'file',
    '.cs': 'file',
    '.vbs': 'file',
    '.ico': 'file',
    '.html': 'file',
  },
  plugins: [
    pluginRenderer(),
    pluginStatic(),
    pluginPreload(path.resolve(__dirname, './preload')),
    pluginVueDevtools(path.resolve(__dirname, '../extensions')),
    pluginWorker(),
    plugin7Zip(path.resolve(__dirname, './node_modules')),
    pluginNode(),
    yamlPlugin({}),
  ],
  external: ['electron'],
}

export default config
