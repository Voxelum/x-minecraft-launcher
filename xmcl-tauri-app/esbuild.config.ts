import { BuildOptions, Plugin } from 'esbuild'
import { yamlPlugin } from 'esbuild-plugin-yaml'
import { resolve } from 'path'
import plugin7Zip from '../xmcl-electron-app/plugins/esbuild.native.plugin'
import pluginElevate from '../xmcl-electron-app/plugins/esbuild.elevate.plugin'
import pluginNode from '../xmcl-electron-app/plugins/esbuild.node.plugin'
import pluginStatic from '../xmcl-electron-app/plugins/esbuild.static.plugin'
import pluginTreeshake from '../xmcl-electron-app/plugins/esbuild.treeshake.plugin'
import pluginWorker from '../xmcl-electron-app/plugins/esbuild.worker.plugin'

const dev = process.env.NODE_ENV !== 'production'

const shared = {
  bundle: true,
  treeShaking: true,
  keepNames: true,
  sourcemap: dev ? 'linked' : 'external',
  minifyWhitespace: !dev,
  minifySyntax: !dev,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
} satisfies BuildOptions

/**
 * The Node process hosting `xmcl-runtime`. It is a plain Node bundle: unlike
 * the Electron target there is nothing to mark external, since the shell only
 * spawns `node dist/sidecar.js`.
 */
export const sidecarConfig = {
  ...shared,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  metafile: true,
  // Named entry so the bundle lands on `dist/sidecar.js`, which is what
  // `src-tauri/src/sidecar.rs` spawns.
  entryPoints: { sidecar: resolve(__dirname, 'sidecar/index.ts') },
  // `outdir`, not `outfile`: the runtime spawns worker threads and ships native
  // binaries, which the reused esbuild plugins emit as sibling files.
  outdir: resolve(__dirname, 'dist'),
  entryNames: '[name]',
  assetNames: '[name]',
  loader: {
    '.png': 'file',
    '.jpeg': 'file',
    '.jpg': 'file',
    '.svg': 'file',
    '.webp': 'file',
    '.gif': 'file',
    '.cs': 'file',
    '.vbs': 'text',
    '.ico': 'file',
    '.class': 'binary',
    '.html': 'file',
    '.wasm': 'file',
  },
  // The same plugins the Electron main bundle uses. They are shell-agnostic:
  // `?worker` imports, `.node` binaries, static assets, the 7-Zip binding and
  // the elevate helper all behave identically under a plain Node process.
  plugins: [
    pluginTreeshake(),
    pluginStatic(),
    pluginWorker(),
    pluginElevate(),
    plugin7Zip(),
    pluginNode(),
    // The plugin is typed against an older esbuild; its shape is compatible.
    yamlPlugin({}) as Plugin,
  ],
} satisfies BuildOptions

/**
 * The renderer bridge, injected as the webview's initialization script.
 *
 * The aliases are what let this target reuse the preload modules of
 * `xmcl-electron-app` instead of forking them: `electron` becomes the shim
 * routing channels to Tauri or to the sidecar, `events` becomes a small
 * emitter, and `@xmcl/runtime-api` becomes empty because the preload only
 * imports its types — resolving it for real would drag the command registry
 * and its zod schemas into every window.
 */
export const preloadConfig = {
  ...shared,
  platform: 'browser',
  target: 'safari16',
  format: 'iife',
  entryPoints: [resolve(__dirname, 'preload/index.ts')],
  outfile: resolve(__dirname, 'dist/preload.js'),
  alias: {
    electron: resolve(__dirname, 'preload/shim/electron.ts'),
    events: resolve(__dirname, 'preload/shim/events.ts'),
    '@xmcl/runtime-api': resolve(__dirname, 'preload/shim/runtime-api.ts'),
  },
} satisfies BuildOptions
