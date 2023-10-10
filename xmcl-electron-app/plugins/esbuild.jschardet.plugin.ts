import { Plugin } from 'esbuild'
import { readFile } from 'fs/promises'

/**
 * @returns {import('esbuild').Plugin}
 */
export default function createJschardetPlugin(): Plugin {
  return {
    name: 'jschardet-import',
    setup(build) {
      if (build.initialOptions) {
        build.onLoad({ filter: /universaldetectors?\.js/g }, async ({ path }) => {
          const content = await readFile(path, 'utf-8')
          return {
            contents: content.replace('denormalizedEncodings = [];', 'const denormalizedEncodings = [];'),
            loader: 'js',
          }
        })
      }
    },
  }
}
