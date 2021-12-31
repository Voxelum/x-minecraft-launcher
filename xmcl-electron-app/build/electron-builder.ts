import chalk from 'chalk'
import { createHash } from 'crypto'
import { build as electronBuilder, Configuration } from 'electron-builder'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { stat } from 'fs-extra'
import { pipeline } from 'stream'
import { promisify } from 'util'

/**
 * @returns Hash string
 */
async function writeHash(algorithm: string, path: string, destination: string) {
  const hash = createHash(algorithm).setEncoding('hex')
  await promisify(pipeline)(createReadStream(path), hash, createWriteStream(destination))
}

/**
 * Use electron builder to build your app to installer, zip, or etc.
 *
 * @param config The electron builder config
 * @param dir Use dir mode to build
 */
export async function buildElectron(config: Configuration, dir: boolean) {
  console.log(chalk.bold.underline('Build electron'))
  const start = Date.now()
  const files = await electronBuilder({ publish: 'never', config, dir })

  for (const file of files) {
    const fstat = await stat(file)
    console.log(
      `${chalk.gray('[write]')} ${chalk.yellow(file)} ${(
        fstat.size /
        1024 /
        1024
      ).toFixed(2)}mb`,
    )
  }

  for (const file of files) {
    const fstat = await stat(file)
    if (!file.endsWith('.blockmap')) {
      await writeHash('sha256', file, `${file}.sha256`)
      await writeHash('sha1', file, `${file}.sha1`)
    }
  }

  if (existsSync('build/win-unpacked/resources/app.asar')) {
    await writeHash('sha256', 'build/win-unpacked/resources/app.asar', 'build/win-unpacked/resources/app.asar.sha256')
  }

  console.log(
    `Build completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`,
  )
}
