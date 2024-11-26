import { Plugin } from 'esbuild'
import { readFileSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

export default function createElevatePlugin(): Plugin {
  return {
    name: 'provide-elevate',
    setup(build) {
      build.onResolve({ filter: /^virtual:elevate.exe$/g }, async ({ path }) => ({
        path,
        namespace: 'elevate',
      }))
      build.onLoad({ filter: /^.+$/g, namespace: 'elevate' }, async () => {
        if (process.platform !== 'win32') {
          // should not bundle elevate.exe on non-windows platform
          return {
            contents: 'export default ""',
          }
        }
        const buf = readFileSync(join(__dirname, '..', 'build', 'elevate.exe'))
        const compressed = gzipSync(buf).toString('base64')
        return {
          contents: `export default "${compressed}"`,
        }
      })
    },
  }
}
