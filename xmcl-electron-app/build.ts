import chalk from 'chalk'
import { createHash } from 'crypto'
import { build as electronBuilder, Configuration } from 'electron-builder'
import { build as esbuild, BuildOptions, Metafile } from 'esbuild'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { copy, readdir, remove, stat } from 'fs-extra'
import path, { resolve } from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { buildAppInstaller } from './build/appinstaller-builder'
import { config as electronBuilderConfig } from './build/electron-builder.config'
import esbuildConfig from './esbuild.config'
import { version } from './package.json'

/**
 * @returns Hash string
 */
async function writeHash(algorithm: string, path: string, destination: string) {
  const hash = createHash(algorithm).setEncoding('hex')
  await promisify(pipeline)(createReadStream(path), hash, createWriteStream(destination))
}

/**
 * Use esbuild to build main process
 */
async function buildMain(options: BuildOptions) {
  const result = await esbuild({
    ...options,
    outdir: resolve(__dirname, './dist'),
    entryPoints: [path.join(__dirname, './main/index.ts')],
  })

  if (!result.metafile) {
    throw new Error('Unexpected rollup config to build!')
  }

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
}

/**
 * Use electron builder to build your app to installer, zip, or etc.
 *
 * @param config The electron builder config
 * @param dir Use dir mode to build
 */
async function buildElectron(config: Configuration, dir: boolean) {
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

  if (existsSync('build/output/win-unpacked/resources/app.asar')) {
    await writeHash('sha256', 'build/output/win-unpacked/resources/app.asar', 'build/output/win-unpacked/resources/app.asar.sha256')
  }
  if (existsSync('build/output/linux-unpacked/resources/app.asar')) {
    await writeHash('sha256', 'build/output/linux-unpacked/resources/app.asar', 'build/output/linux-unpacked/resources/app.asar.sha256')
  }
  if (existsSync('build/output/mac/xmcl.app/Contents/Resources/app.asar')) {
    await writeHash('sha256', 'build/output/mac/xmcl.app/Contents/Resources/app.asar', 'build/output/mac/xmcl.app/Contents/Resources/app.asar.sha256')
  }

  console.log(
    `Build completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`,
  )
}

async function start() {
  await remove(path.join(__dirname, './dist'))

  console.log(chalk.bold.underline('Build main process & preload'))
  const startTime = Date.now()
  await buildMain(esbuildConfig)
  console.log(
    `Build completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s.\n`,
  )

  await copy(path.join(__dirname, '../xmcl-keystone-ui/dist'), path.join(__dirname, './dist/renderer'))

  console.log()
  if (process.env.BUILD_TARGET) {
    const dir = process.env.BUILD_TARGET === 'dir'
    if (process.env.BUILD_TARGET === 'appx') {
      const files = await readdir(path.join(__dirname, './icons'))
      const storeFiles = files.filter(f => f.endsWith('.png') &&
        !f.endsWith('256x256.png') &&
        !f.endsWith('tray.png'))
        .map((f) => [
          path.join(__dirname, 'icons', f),
          path.join(__dirname, 'build', 'appx', f.substring(f.indexOf('@') + 1)),
        ] as const)
      await Promise.all(storeFiles.map(v => copy(v[0], v[1])))
    }
    await buildElectron(electronBuilderConfig, dir)
    if (process.env.BUILD_TARGET === 'appx') {
      await buildAppInstaller(version, path.join(__dirname, './build/output/xmcl.appinstaller'))
    }
  }
}

start().catch((e) => {
  console.error(chalk.red(e.toString()))
  process.exit(1)
})
