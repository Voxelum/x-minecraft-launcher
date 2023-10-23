import path from 'path'
import pluginPreload from './plugins/esbuild.preload.plugin'
import pluginRenderer from './plugins/esbuild.renderer.plugin'
import pluginWorker from './plugins/esbuild.worker.plugin'
import pluginVueDevtools from './plugins/esbuild.devtool.plugin'
import pluginNode from './plugins/esbuild.node.plugin'
import plugin7Zip from './plugins/esbuild.native.plugin'
import pluginStatic from './plugins/esbuild.static.plugin'
import pluginJsdetect from './plugins/esbuild.jschardet.plugin'
import { yamlPlugin } from 'esbuild-plugin-yaml'
import { BuildOptions } from 'esbuild'
import 'dotenv/config'

const config = {
  bundle: true,
  metafile: true,
  assetNames: '[name]',
  entryNames: '[dir]/[name]',
  format: 'cjs',
  sourcemap: 'inline',
  minifyWhitespace: process.env.NODE_ENV === 'production',
  minifySyntax: process.env.NODE_ENV === 'production',
  treeShaking: true,
  keepNames: true,
  define: {
    'process.env.BUILD_TARGET': JSON.stringify(process.env.BUILD_TARGET) ?? '""',
    'process.env.BUILD_NUMBER': JSON.stringify(process.env.BUILD_NUMBER) ?? '0',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV) ?? '"development"',
    'process.env.CURSEFORGE_API_KEY': JSON.stringify(process.env.CURSEFORGE_API_KEY),
    'process.env.RUNTIME': JSON.stringify(process.env.RUNTIME || 'raw'),
  } as Record<string, string>,
  platform: 'node',
  loader: {
    '.png': 'file',
    '.jpeg': 'file',
    '.jpg': 'file',
    '.svg': 'file',
    '.webp': 'file',
    '.gif': 'file',
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
    pluginJsdetect(),
    plugin7Zip(path.resolve(__dirname, './node_modules')),
    pluginNode(),
    yamlPlugin({}) as any,
  ],
  external: ['electron'],
} satisfies BuildOptions

export default config
