import { Plugin } from 'esbuild'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'

/**
 * Print esbuild result files to console
 */
export default function createSourcemapPlugin(): Plugin {
  return {
    name: 'sourcemap',
    setup(build) {
      if (!build.initialOptions.plugins!.find(v => v.name === 'dev')) {
        const entry = (build.initialOptions.entryPoints as string[])[0]!
        function escapeRegExp(s: string) {
          return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        }
        const reg = new RegExp(`^${escapeRegExp(entry)}$`)
        build.onLoad({ filter: reg }, async ({ path }) => {
          const injectContent = await readFile(join(__dirname, '../sourcemap.ts'), 'utf-8')
          const content = await readFile(path, 'utf-8')
          return {
            contents: `${injectContent}\n${content}`,
            loader: 'ts',
          }
        })
      }
    },
  }
}
