import chalk from 'chalk'
import { Metafile, Plugin } from 'esbuild'

/**
 * Print esbuild result files to console
 */
export default function createPrintPlugin(): Plugin {
  return {
    name: 'print-result',
    setup(build) {
      build.onEnd(async (result) => {
        /**
         * Print the esbuild output
         */
        async function printOutput(options: Metafile) {
          for (const [file, chunk] of Object.entries(options.outputs)) {
            console.log(
              `${chalk.gray('[write]')} ${chalk.cyan(file)}  ${(
                chunk.bytes / 1024
              ).toFixed(2)}kb`,
            )
          }
        }
        if (result.metafile) {
          await printOutput(result.metafile)
        }
      })
    },
  }
}
