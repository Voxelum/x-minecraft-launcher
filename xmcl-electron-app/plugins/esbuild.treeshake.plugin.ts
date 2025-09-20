import { Plugin } from 'esbuild'
import { isAbsolute, join } from 'path'

const noSideEffectPackages = [
  'semver',
  'kysely',
  'uuid',
  'undici',
  'ssh2',
  'chokidar',
  'smol-toml',
  'glob',
  'readable-stream',
  'entities',
  'filenamify',
  'css-select',
  'fs-extra',
  'debug',
  'create-desktop-shortcuts',
  'atomically'
]

export default function createTreeshakePlugin(): Plugin {
  return {
    name: 'treeshake',
    setup(build) {
      // match ts or js files
      build.onResolve({ filter: /\.(ts|js)$/ }, async (args) => {
        const abs = isAbsolute(args.path) ? args.path : join(args.resolveDir, args.path)
        if (noSideEffectPackages.some(pkg => abs.includes(pkg))) {
          return {
            path: abs,
            sideEffects: false,
          }
        }
        return {
          path: abs,
        }
      })
    },
  }
}
