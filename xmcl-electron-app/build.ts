import { rebuild } from '@electron/rebuild'
import chalk from 'chalk'
import { createHash } from 'crypto'
import { Configuration, build as electronBuilder } from 'electron-builder'
import { BuildOptions, build as esbuild } from 'esbuild'
import { createReadStream, createWriteStream } from 'fs'
import { copy, ensureFile } from 'fs-extra'
import { copyFile, readdir, rm, stat } from 'fs/promises'
import path, { resolve } from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { buildAppInstaller } from './build/appinstaller-builder'
import { config as electronBuilderConfig } from './build/electron-builder.config'
import esbuildConfig from './esbuild.config'
import { version } from './package.json'
import createPrintPlugin from 'plugins/esbuild.print.plugin'

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
async function buildMain(options: BuildOptions, slient = false) {
  await rm(path.join(__dirname, './dist'), { recursive: true, force: true })
  if (!slient) console.log(chalk.bold.underline('Build main process & preload'))
  const startTime = Date.now()
  if (!slient) options.plugins?.push(createPrintPlugin())
  await esbuild({
    ...options,
    outdir: resolve(__dirname, './dist'),
    entryPoints: [path.join(__dirname, './main/index.ts')],
  })
  const time = ((Date.now() - startTime) / 1000).toFixed(2)
  if (!slient) console.log(`Build completed in ${time}s.`)
  await copy(path.join(__dirname, '../xmcl-keystone-ui/dist'), path.join(__dirname, './dist/renderer'))
  if (!slient) console.log('\n')
  return time
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
    if (!file.endsWith('.blockmap')) {
      await writeHash('sha256', file, `${file}.sha256`)
    }
  }

  console.log(
    `Build completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`,
  )
}

async function start() {
  if (!process.env.BUILD_TARGET) {
    await buildMain(esbuildConfig)
    return
  }
  const dir = process.env.BUILD_TARGET === 'dir'
  const config: Configuration = {
    ...electronBuilderConfig,
    async beforeBuild(context) {
      await rebuild({
        buildPath: context.appDir,
        electronVersion: context.electronVersion,
        arch: context.arch,
        types: ['dev'],
      })
      console.log(`  ${chalk.blue('•')} rebuilt native modules ${chalk.blue('electron')}=${context.electronVersion} ${chalk.blue('arch')}=${context.arch}`)
      const time = await buildMain(esbuildConfig, true)
      console.log(`  ${chalk.blue('•')} compiled main process & preload in ${chalk.blue('time')}=${time}s`)
    },
    async artifactBuildStarted(context) {
      if (context.targetPresentableName.toLowerCase() === 'appx') {
        console.log(`  ${chalk.blue('•')} copy appx icons`)
        const files = await readdir(path.join(__dirname, './icons'))
        const storeFiles = files.filter(f => f.endsWith('.png') &&
          !f.endsWith('256x256.png') &&
          !f.endsWith('tray.png'))
          .map((f) => [
            path.join(__dirname, 'icons', f),
            path.join(__dirname, 'build', 'appx', f.substring(f.indexOf('@') + 1)),
          ] as const)
        await Promise.all(storeFiles.map(v => ensureFile(v[1]).then(() => copyFile(v[0], v[1]))))
      }
    },
    async artifactBuildCompleted(context) {
      if (!context.arch) return
      if (context.target && context.target.name === 'appx') {
        await buildAppInstaller(version, path.join(__dirname, './build/output/xmcl.appinstaller'), electronBuilderConfig.appx!.publisher!)
      }
    },
  }

  await buildElectron(config, dir)
}

start().catch((e) => {
  console.error(chalk.red(e.toString()))
  process.exit(1)
})
