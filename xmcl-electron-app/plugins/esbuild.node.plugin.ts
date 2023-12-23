import { Plugin } from 'esbuild'
import { readFile } from 'fs/promises'
/**
 * Resolve native .node module
 */
export default function createNodePlugin(): Plugin {
  return {
    name: 'resolve-node',
    setup(build) {
      const isDev = build.initialOptions.plugins!.find(v => v.name === 'dev')

      // If a ".node" file is imported within a module in the "file" namespace, resolve
      // it to an absolute path and put it into the "node-file" virtual namespace.
      build.onResolve(
        { filter: /\.node$/, namespace: 'file' },
        (args) => ({
          path: args.path,
          namespace: 'node-file',
          pluginData: {
            ...(args.pluginData || {}),
            resolveDir: args.resolveDir,
          },
        }),
      )

      // build.onResolve(
      //   { filter: /^.+\.post-node$$/ },
      //   (args) => {
      //     console.log('resolv ?node %o', args)
      //     const path = args.path.substring(0, args.path.length - '.post-node'.length) + '.node'
      //     return ({
      //       path: require.resolve(path, {
      //         paths: [args.resolveDir],
      //       }),
      //       namespace: 'NodeFile',
      //       pluginData: args.pluginData,
      //       external: !!build.initialOptions.watch,
      //     })
      //   },
      // )
      // Files in the "NodeFile" virtual namespace call "require()" on the
      // Files in the "node-file" virtual namespace call "require()" on the
      // path from esbuild of the ".node" file in the output directory.
      build.onLoad({ filter: /.*/, namespace: 'node-file' }, (args) => {
        const resolved = require.resolve(args.path, {
          paths: [args.pluginData.resolveDir],
        })
        return ({
          contents: `
try { const path = require(${JSON.stringify(resolved)}); module.exports = typeof path === 'string' ? require(path) : path }
catch (e) { debugger; console.error('Fail to require native node module ' + ${JSON.stringify(args.path)}); console.error(e); }
        `,
          loader: 'js',
        })
      })

      // If a ".node" file is imported within a module in the "node-file" namespace, put
      // it in the "file" namespace where esbuild's default loading behavior will handle
      // it. It is already an absolute path since we resolved it to one above.
      build.onResolve(
        { filter: /\.node$/, namespace: 'node-file' },
        (args) => ({
          path: args.path,
          namespace: 'file',
          external: !!isDev,
          pluginData: args.pluginData,
        }),
      )

      // Tell esbuild's default loading behavior to use the "file" loader for
      // these ".node" files.
      const opts = build.initialOptions
      opts.loader = opts.loader || {}
      opts.loader['.node'] = 'file'
    },
  }
}
