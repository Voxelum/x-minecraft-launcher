import asar from '@electron/asar'
import chalk from 'chalk'
import { createHash } from 'crypto'
import { Arch, build as electronBuilder, Configuration } from 'electron-builder'
import { build as esbuild, BuildOptions } from 'esbuild'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { copy, ensureFile } from 'fs-extra'
import { copyFile, mkdir, readdir, rename, rm, stat, unlink, writeFile } from 'fs/promises'
import { platform } from 'os'
import path, { basename, dirname, join, resolve } from 'path'
import { pipeline, Writable } from 'stream'
import { promisify } from 'util'
import { buildAppInstaller } from './build/appinstaller-builder'
import { config as electronBuilderConfig } from './build/electron-builder.config'
import esbuildConfig from './esbuild.config'
import { version } from './package.json'
// @ts-ignore
import pump from 'pump'
// @ts-ignore
import tfs from 'tar-fs'
import { stream } from 'undici'
import { createGunzip } from 'zlib'
import { ensureFileSync } from 'fs-extra/esm'

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
  await rm(path.join(__dirname, './dist'), { recursive: true, force: true })
  console.log(chalk.bold.underline('Build main process & preload'))
  const startTime = Date.now()
  await esbuild({
    ...options,
    outdir: resolve(__dirname, './dist'),
    entryPoints: [path.join(__dirname, './main/index.ts')],
  })
  console.log(
    `Build completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s.\n`,
  )
  await copy(path.join(__dirname, '../xmcl-keystone-ui/dist'), path.join(__dirname, './dist/renderer'))
  console.log()
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
  const unpack = async (tarPath: string) => {
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
    console.log(`Download and unpack to ${unpackTo}`)
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
    },
  }

  if (currentPlatform === 'darwin' || currentPlatform === 'linux') {
    const result = await Promise.all(Object.entries(urls[currentPlatform]).map(async ([name, url]) => {
      const tarGz = resolve(__dirname, `cache/${name}.tar.gz`)
      await ensureFile(tarGz)
      await download(url, tarGz)
      return tarGz
    }))
    await Promise.all(result.map(unpack))
  }

  if (currentPlatform === 'linux') {
    // copy classic-level dependencies
    const src = resolve(__dirname, '../xmcl-runtime/node_modules/classic-level/prebuilds/linux-arm64/node.napi.armv8.node')
    const dest = resolve(__dirname, 'dist/node.napi.glibc.node')
    await unlink(dest).catch(() => { })
    await copyFile(src, dest)
    console.log(`copy ${src} -> ${dest}`)
  }
}

async function start() {
  await buildMain(esbuildConfig)

  if (process.env.BUILD_TARGET) {
    const dir = process.env.BUILD_TARGET === 'dir'
    const config: Configuration = {
      ...electronBuilderConfig,
      async beforePack(context) {
        const asarFile = join(context.appOutDir, 'resources', 'app.asar')
        const distDir = join(context.packager.projectDir, 'dist')

        // Install arm64 dependencies
        if (context.arch === 3) {
          await installArm64()
        }

        console.log('overwrite asar', asarFile)

        await asar.createPackage(distDir, asarFile)
      },
      async artifactBuildStarted(context) {
        if (context.targetPresentableName.toLowerCase() === 'appx') {
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

    const currentPlatform = platform()
    const runtime = currentPlatform === 'win32'
      ? 'appx'
      : currentPlatform === 'linux'
        ? 'appimage'
        : undefined

    if (!dir && runtime) {
      // Build appx and appImage additionally
      (config.win as any).target = ['appx'];
      (config.linux as any).target = [{ target: 'AppImage', arch: ['x64', 'arm64'] }]

      esbuildConfig.define['process.env.RUNTIME'] = `"${runtime}"`
      await buildMain(esbuildConfig)

      await buildElectron(config, dir)
    }
  }
}

start().catch((e) => {
  console.error(chalk.red(e.toString()))
  process.exit(1)
})
