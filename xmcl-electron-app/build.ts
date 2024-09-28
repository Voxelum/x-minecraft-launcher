import { rebuild } from '@electron/rebuild'
import chalk from 'chalk'
import { createHash } from 'crypto'
import { Configuration, build as electronBuilder } from 'electron-builder'
import { BuildOptions, build as esbuild } from 'esbuild'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { copy, emptyDir, ensureFile } from 'fs-extra'
import { copyFile, readdir, stat, writeFile } from 'fs/promises'
import path, { join, resolve } from 'path'
import createPrintPlugin from 'plugins/esbuild.print.plugin'
import { createGzip } from 'zlib'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { buildAppInstaller } from './build/appinstaller-builder'
import { config as electronBuilderConfig } from './build/electron-builder.config'
import esbuildConfig from './esbuild.config'
import { version } from './package.json'

/**
 * @returns Hash string
 */
async function writeHash(algorithm: string, path: string) {
  const hash = createHash(algorithm).setEncoding('hex')
  await promisify(pipeline)(createReadStream(path), hash, createWriteStream(path + '.sha256'))
}

/**
 * Use esbuild to build main process
 */
async function buildMain(options: BuildOptions, slient = false) {
  await emptyDir(path.join(__dirname, './dist'))
  if (!slient) console.log(chalk.bold.underline('Build main process & preload'))
  const startTime = Date.now()
  if (!slient) options.plugins?.push(createPrintPlugin())
  const out = await esbuild({
    ...options,
    outdir: resolve(__dirname, './dist'),
    entryPoints: [path.join(__dirname, './main/index.ts')],
  })

  if (options.metafile) {
    await writeFile('./meta.json', JSON.stringify(out.metafile, null, 2))
  }
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
      await writeHash('sha256', file)
    }
  }

  console.log(
    `Build completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`,
  )
}

async function start() {
  if (process.env.BUILD_TARGET === 'none') {
    await buildMain(esbuildConfig)
    return
  }
  const dir = !process.env.BUILD_TARGET
  // Create empty binding.gyp to let electron-rebuild trigger rebuild to it
  await ensureFile(resolve(__dirname, 'node_modules', 'node_datachannel', 'binding.gyp'))
  const config: Configuration = {
    ...electronBuilderConfig,
    async beforeBuild(context) {
      const rebuildProcess = rebuild({
        buildPath: context.appDir,
        electronVersion: context.electronVersion,
        arch: context.arch,
        types: ['dev'],
      })
      rebuildProcess.lifecycle.on('module-found', (path: string) => {
        console.log(`  ${chalk.blue('•')} rebuild module ${chalk.blue('path')}=${path}`)
      })
      await rebuildProcess
      console.log(`  ${chalk.blue('•')} rebuilt native modules ${chalk.blue('electron')}=${context.electronVersion} ${chalk.blue('arch')}=${context.arch}`)
      const time = await buildMain({ ...esbuildConfig, metafile: true }, true)
      console.log(`  ${chalk.blue('•')} compiled main process & preload in ${chalk.blue('time')}=${time}s`)
    },
    async afterPack(context) {
      const suffix = context.arch === 3 ? '-arm64' : context.arch === 0 ? '-ia32' : ''
      const platformName = (process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux') + suffix

      const dest = `build/output/app-${version}-${platformName}.asar`
      const gzipDest = dest + '.gz'
      let src = join(context.appOutDir, 'resources/app.asar')
      if (!existsSync(src)) {
        src = join(context.appOutDir, 'X Minecraft Launcher.app/Contents/Resources/app.asar')
      } else if (!existsSync(src)) {
        console.log(`  ${chalk.yellow('•')} fallback to ${chalk.yellow('Resources/app.asar')} for ${chalk.yellow('resources/app.asar')} not found`)
      }
      await copyFile(src, dest)
      await writeHash('sha256', dest)
      await promisify(pipeline)(createReadStream(dest), createGzip(), createWriteStream(gzipDest))
      console.log(`  ${chalk.blue('•')} prepare asar with checksum ${chalk.blue('from')}=${src} ${chalk.blue('to')}=${dest}`)
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
  process.exit(0)
}

start().catch((e) => {
  console.error(chalk.red(e.toString()))
  process.exit(1)
})
