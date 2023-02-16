import chalk from 'chalk'
import { createHash } from 'crypto'
import { build as electronBuilder, Configuration } from 'electron-builder'
import { build as esbuild, BuildOptions } from 'esbuild'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { copyFile, readdir, rename, rm, stat, symlink, unlink } from 'fs/promises'
import path, { basename, dirname, join, resolve } from 'path'
import { pipeline, Writable } from 'stream'
import { promisify } from 'util'
import { buildAppInstaller } from './build/appinstaller-builder'
import { config as electronBuilderConfig } from './build/electron-builder.config'
import esbuildConfig from './esbuild.config'
import { version } from './package.json'
// @ts-ignore
import tfs from 'tar-fs'
// @ts-ignore
import { ensureFile } from 'fs-extra'
import { platform } from 'os'
import pump from 'pump'
import { stream } from 'undici'
import { createGunzip } from 'zlib'

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
  await esbuild({
    ...options,
    outdir: resolve(__dirname, './dist'),
    entryPoints: [path.join(__dirname, './main/index.ts')],
  })
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
  if (existsSync('build/output/mac/X Minecraft Launcher.app/Contents/Resources/app.asar')) {
    await writeHash('sha256', 'build/output/mac/X Minecraft Launcher.app/Contents/Resources/app.asar', 'build/output/mac/X Minecraft Launcher.app/Contents/Resources/app.asar.sha256')
  }

  console.log(
    `Build completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`,
  )
}

const currentPlatform = platform()
async function installArm64() {
  const downloadAndUnpack = async (tarPath: string) => {
    const options = {
      readable: true,
      writable: true,
      hardlinkAsFilesFallback: true,
    }
    let binaryName = ''
    function updateName(entry: any) {
      if (/\.node$/i.test(entry.name)) binaryName = entry.name
    }

    const dir = dirname(tarPath)
    await ensureFile(tarPath)
    await new Promise<void>((resolve, reject) => {
      pump(
        createReadStream(tarPath),
        createGunzip(),
        tfs.extract(dir, options).on('entry', updateName), (err: any) => {
          if (err) return reject(err)
          else resolve()
        })
    })

    const unpackTo = resolve(__dirname, 'dist', basename(binaryName))
    await unlink(unpackTo).catch(() => undefined)
    await rename(join(dir, binaryName), unpackTo)
  }

  const download = async (url: string, dest: string) => await stream(url, {
    method: 'GET',
    throwOnError: true,
    maxRedirections: 2,
    opaque: createWriteStream(dest),
  }, ({ opaque }) => opaque as Writable)

  const urls = {
    darwin: {
      keytar: 'https://github.com/atom/node-keytar/releases/download/v7.9.0/keytar-v7.9.0-napi-v3-darwin-arm64.tar.gz',
      nodeDataChannel: 'https://github.com/murat-dogan/node-datachannel/releases/download/v0.4.1/node-datachannel-v0.4.1-node-v93-darwin-arm64.tar.gz',
      classicLevel: 'https://github.com/Level/classic-level/releases/download/v1.2.0/darwin-x64+arm64.tar.gz',
    },
    linux: {
      keytar: 'https://github.com/atom/node-keytar/releases/download/v7.9.0/keytar-v7.9.0-napi-v3-linux-arm64.tar.gz',
      nodeDataChannel: 'https://github.com/murat-dogan/node-datachannel/releases/download/v0.4.1/node-datachannel-v0.4.1-node-v93-linux-arm64.tar.gz',
      classicLevel: 'https://github.com/Level/classic-level/releases/download/v1.2.0/linux-arm.tar.gz',
    },
  }

  if (currentPlatform === 'darwin' || currentPlatform === 'linux') {
    const result = await Promise.all(Object.entries(urls[currentPlatform]).map(async ([name, url]) => {
      const tarGz = resolve(__dirname, `cache/${name}.tar.gz`)
      await ensureFile(tarGz)
      await download(url, tarGz)
      return tarGz
    }))
    await Promise.all(result.map(downloadAndUnpack))
  }
}

async function start() {
  await rm(path.join(__dirname, './dist'), { recursive: true, force: true })

  console.log(chalk.bold.underline('Build main process & preload'))
  const startTime = Date.now()
  await buildMain(esbuildConfig)
  console.log(
    `Build completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s.\n`,
  )

  await symlink(path.join(__dirname, '../xmcl-keystone-ui/dist'), path.join(__dirname, './dist/renderer')).catch(() => undefined)

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
      await Promise.all(storeFiles.map(v => copyFile(v[0], v[1])))
    }
    await buildElectron({
      ...electronBuilderConfig,
      async artifactBuildCompleted(context) {
        if (context.target && context.target.name === 'appx') {
          await buildAppInstaller(version, path.join(__dirname, './build/output/xmcl.appinstaller'), electronBuilderConfig.appx!.publisher!)
        }
      },
    }, dir)

    if (currentPlatform !== 'win32') {
      await installArm64()
      for (const t of electronBuilderConfig.mac.target) {
        t.arch = 'arm64'
      }
      for (const t of electronBuilderConfig.linux.target) {
        t.arch = 'arm64'
      }
      await buildElectron({
        ...electronBuilderConfig,
        async artifactBuildCompleted(context) {
          if (context.target && context.target.name === 'appx') {
            await buildAppInstaller(version, path.join(__dirname, './build/output/xmcl.appinstaller'), electronBuilderConfig.appx!.publisher!)
          }
        },
      }, dir)
    }
  }
}

start().catch((e) => {
  console.error(chalk.red(e.toString()))
  process.exit(1)
})
