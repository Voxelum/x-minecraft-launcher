import { HAS_DEV_SERVER } from '@/constant'
import {
  DownloadBaseOptions,
  ProgressTracker,
  download,
  getDownloadBaseOptions,
} from '@xmcl/file-transfer'
import { Tracker, onDownloadSingle } from '@xmcl/installer'
import {
  DownloadUpdateTrackerEvents,
  ElectronUpdateOperation,
  ReleaseInfo,
} from '@xmcl/runtime-api'
import { DownloadUpdateOptions, LauncherAppUpdater } from '@xmcl/runtime/app'
import { AnyError, isSystemError } from '@xmcl/utils'
import { spawn } from 'child_process'
import { app, shell } from 'electron'
import * as updater from 'electron-updater'
import { AppUpdater, CancellationToken, UpdaterSignal } from 'electron-updater'
import { createReadStream, createWriteStream } from 'fs'
import { readFile, rename as renameAsync, unlink as unlinkAsync, writeFile } from 'fs-extra'
import { closeSync, existsSync, open, rename, unlink } from 'original-fs'
import { platform } from 'os'
import { basename, dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { setTimeout } from 'timers/promises'
import { promisify } from 'util'
import { createGunzip } from 'zlib'
import { Logger, kGFW } from '~/infra'
import { kSettings } from '~/settings'
import { checksum } from '~/util/fs'
import ElectronLauncherApp from '../ElectronLauncherApp'
import { ensureElevateExe } from './elevate'

const kPatched = Symbol('Patched')

/**
 * Only download asar file update.
 *
 * If the this update is not a full update but an incremental update,
 * you can call this to download asar update
 */
async function downloadAsarUpdate(
  app: ElectronLauncherApp,
  destination: string,
  version: string,
  options?: {
    abortSignal?: AbortSignal
    tracker?: Tracker<DownloadUpdateTrackerEvents>
  } & DownloadBaseOptions,
): Promise<void> {
  version = version.startsWith('v') ? version.substring(1) : version
  const pl = platform()
  let platformFlag = pl === 'win32' ? 'win' : pl === 'darwin' ? 'mac' : 'linux'
  if (process.arch === 'arm64') {
    platformFlag += '-arm64'
  } else if (process.arch === 'ia32') {
    platformFlag += '-ia32'
  }
  const file = `app-${version}-${platformFlag}.asar`

  const gfw = await app.registry.get(kGFW)
  const urls = gfw.inside
    ? [`https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/${file}`]
    : [`https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/${file}`]

  const errors: Error[] = []

  for (const url of urls) {
    try {
      // Check if file already exists with correct hash
      const sha256Response = await app.fetch(url + '.sha256', { signal: options?.abortSignal })
      const sha256 = sha256Response.ok ? await sha256Response.text() : ''
      const actual = await checksum(destination, 'sha256').catch(() => '')
      if (sha256 === actual) {
        return
      }

      const gzUrl = url + '.gz'
      if (url.startsWith('https://files.0x.cn')) {
        app.emit('download-cdn', 'asar', file)
      }

      // Try downloading compressed version first
      const gzResponse = await app
        .fetch(gzUrl, { method: 'HEAD', signal: options?.abortSignal })
        .catch(() => null)
      const downloadUrl = gzResponse?.ok ? gzUrl : url

      // Download to temporary file
      const tempFile = destination + '.tmp'
      await download({
        url: downloadUrl,
        destination: tempFile,
        tracker: onDownloadSingle(options?.tracker, 'download-update.asar', { url: downloadUrl }),
        signal: options?.abortSignal,
        ...getDownloadBaseOptions(options),
      })

      // If it's gzipped, decompress it
      if (downloadUrl === gzUrl) {
        await pipeline(createReadStream(tempFile), createGunzip(), createWriteStream(destination))
        await unlinkAsync(tempFile)
      } else {
        await renameAsync(tempFile, destination)
      }

      return
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return
      }
      errors.push(Object.assign(e as Error, { name: 'UpdateAsarError', url }))
    }
  }
  throw new AggregateError(
    errors.flatMap((e) => (e instanceof AggregateError ? e.errors : e)),
    'Fail to download asar update',
  )
}

async function hintUserDownload(): Promise<void> {
  shell.openExternal('https://xmcl.app')
}

async function downloadAppInstaller(
  launcherApp: ElectronLauncherApp,
  options?: {
    abortSignal?: AbortSignal
    tracker?: Tracker<DownloadUpdateTrackerEvents>
  } & DownloadBaseOptions,
): Promise<void> {
  const destination = join(app.getPath('downloads'), 'X Minecraft Launcher.appinstaller')
  const url = 'https://xmcl.blob.core.windows.net/releases/xmcl.appinstaller'

  await download({
    url,
    destination,
    tracker: onDownloadSingle(options?.tracker, 'download-update.appx', { url }),
    signal: options?.abortSignal,
    ...getDownloadBaseOptions(options),
  })

  shell.showItemInFolder(destination)
  await setTimeout(1000)
  await shell.openPath(destination)
  launcherApp.exit()
}

async function getUpdateAsarViaBatArgs(
  appAsarPath: string,
  updateAsarPath: string,
  appDataPath: string,
  elevatePath?: string,
): Promise<string[]> {
  const psPath = join(appDataPath, 'AutoUpdate.bat')
  await writeFile(
    psPath,
    [
      '@echo off',
      'chcp 65001',
      '%WinDir%\\System32\\timeout.exe 2',
      `taskkill /f /im "${basename(process.argv[0])}"`,
      `copy /Y "${updateAsarPath}" "${appAsarPath}"`,
      `start /b "" /d "${process.cwd()}" ${process.argv.map((s) => `"${s}"`).join(' ')}`,
    ].join('\r\n'),
  )

  return elevatePath ? [elevatePath, psPath] : ['cmd.exe', '/c', psPath]
}
/**
 * Download the full update. This size can be larger as it carry the whole electron thing...
 */
async function downloadFullUpdate(
  app: ElectronLauncherApp,
  appUpdater: AppUpdater,
  options?: {
    tracker?: Tracker<DownloadUpdateTrackerEvents>
    abortSignal?: AbortSignal
  },
): Promise<void> {
  const gfw = await app.registry.get(kGFW)

  if (gfw.inside) {
    // @ts-ignore
    const executor = appUpdater.httpExecutor as any
    if (!(kPatched in executor)) {
      const createRequest = executor.createRequest.bind(executor)
      Object.assign(executor, {
        [kPatched]: true,
        createRequest: (options: any, callback: any) => {
          if (gfw.inside) {
            options.hostname = 'files.0xc.cn'
            options.pathname = `/Soft_Mirrors/github-release/Voxelum/x-minecraft-launcher/LatestRelease/${basename(options.pathname)}`
            app.emit('download-cdn', 'electron', basename(options.pathname))
          }
          return createRequest(options, callback)
        },
      })
    }
  }

  const tracker: ProgressTracker = {
    progress: 0,
    total: 0,
    url: '',
  }
  options?.tracker?.({
    phase: 'download-update.full',
    payload: { progress: tracker },
  })

  const signal = new UpdaterSignal(appUpdater)
  signal.progress((info) => {
    tracker.progress = info.transferred
    tracker.total = info.total
    // tracker.speed = info.bytesPerSecond
  })

  const cancellationToken = new CancellationToken()
  options?.abortSignal?.addEventListener('abort', () => {
    cancellationToken.cancel()
  })
  await appUpdater.downloadUpdate(cancellationToken)
}

function isSameVersion(a: string, b: string) {
  if (a.startsWith('v')) {
    a = a.substring(1)
  }
  if (b.startsWith('v')) {
    b = b.substring(1)
  }
  return a === b
}

export class ElectronUpdater implements LauncherAppUpdater {
  private logger: Logger

  constructor(private app: ElectronLauncherApp) {
    this.logger = app.getLogger('ElectronUpdater')
  }

  async #getUpdateFromSelfHost(): Promise<ReleaseInfo> {
    const app = this.app
    this.logger.log('Try get update from selfhost')
    const { allowPrerelease, locale } = await app.registry.get(kSettings)
    const queryString = `version=v${app.version}&prerelease=${allowPrerelease || false}`
    const response = await this.app
      .fetch(`https://api.xmcl.app/latest?${queryString}`, {
        headers: {
          'Accept-Language': locale,
        },
      })
      .catch(() =>
        this.app.fetch(`https://xmcl-core-api.azurewebsites.net/api/latest?${queryString}`, {
          headers: {
            'Accept-Language': locale,
          },
        }),
      )
    if (!response.ok) {
      throw new AnyError(
        'UpdateError',
        `Fail to get update from selfhost: ${await response.text()}`,
        {},
        { status: response.status },
      )
    }
    const result = (await response.json()) as any
    const files = result.assets.map((a: any) => ({
      url: a.browser_download_url,
      name: a.name,
    })) as Array<{ url: string; name: string }>
    const platformString =
      app.platform.os === 'windows' ? 'win' : app.platform.os === 'osx' ? 'mac' : 'linux'
    const version = result.tag_name.substring(1)
    const updateInfo: ReleaseInfo = {
      name: result.tag_name,
      body: result.body,
      date: result.published_at,
      files,
      newUpdate: !isSameVersion(app.version, result.tag_name),
      operation: ElectronUpdateOperation.Manual,
    }

    const hasAsar = files.some((f) => f.name === `app-${version}-${platformString}.asar`)
    if (this.app.platform.os === 'windows') {
      if (this.app.env === 'appx') {
        updateInfo.operation = ElectronUpdateOperation.Appx
      } else {
        updateInfo.operation = hasAsar
          ? ElectronUpdateOperation.Asar
          : ElectronUpdateOperation.Manual
      }
    } else if (this.app.platform.os === 'osx') {
      updateInfo.operation = hasAsar ? ElectronUpdateOperation.Asar : ElectronUpdateOperation.Manual
    } else {
      updateInfo.operation =
        hasAsar && this.app.env !== 'appimage'
          ? ElectronUpdateOperation.Asar
          : ElectronUpdateOperation.Manual
    }

    this.logger.log(`Got operation=${updateInfo.operation} update from selfhost`)

    return updateInfo
  }

  async #getUpdateFromAutoUpdater(): Promise<ReleaseInfo> {
    const autoUpdater = updater.autoUpdater

    this.logger.log(`Check update via ${autoUpdater.getFeedURL()}`)
    const info = await autoUpdater.checkForUpdates()
    if (!info) throw new Error('No update info found')

    const files = info.updateInfo.files.map((f) => ({ name: basename(f.url), url: f.url }))
    const release: ReleaseInfo = {
      name: info.updateInfo.version,
      body: info.updateInfo.releaseNotes as string,
      date: info.updateInfo.releaseDate,
      files,
      newUpdate: !isSameVersion(info.updateInfo.version, this.app.version),
      operation: ElectronUpdateOperation.AutoUpdater,
    }

    return release
  }

  private async quitAndInstallAsar() {
    const appAsarPath = join(dirname(__dirname), 'app.asar')
    const updateAsarPath = join(this.app.appDataPath, 'pending_update')

    this.logger.log(`Install asar on ${this.app.platform.os} ${appAsarPath}`)
    if (this.app.platform.os === 'windows') {
      const elevatePath = await ensureElevateExe(this.app.appDataPath)

      const appAsarPath = join(dirname(__dirname), 'app.asar')
      const updateAsarPath = join(this.app.appDataPath, 'pending_update')

      if (!existsSync(updateAsarPath)) {
        throw new Error(`No update found: ${updateAsarPath}`)
      }

      let hasWriteAccess = await new Promise((resolve) => {
        open(appAsarPath, 'a', (e, fd) => {
          if (e) {
            resolve(false)
          } else {
            closeSync(fd)
            resolve(true)
          }
        })
      })

      // force elevation for now
      hasWriteAccess = false
      this.logger.log(
        hasWriteAccess
          ? `Process has write access to ${appAsarPath}`
          : `Process does not have write access to ${appAsarPath}`,
      )

      const args = await getUpdateAsarViaBatArgs(
        appAsarPath,
        updateAsarPath,
        this.app.appDataPath,
        !hasWriteAccess ? elevatePath : undefined,
      )
      this.logger.log(`Install from windows: ${args.join(' ')}`)
      const x = spawn(args[0], args.slice(1), {
        cwd: this.app.appDataPath,
        detached: true,
        stdio: 'ignore',
      })
      x.unref()
      this.app.quit()
    } else {
      await promisify(rename)(appAsarPath, appAsarPath + '.bk').catch(() => {})
      try {
        try {
          await promisify(rename)(updateAsarPath, appAsarPath)
        } catch (e) {
          if (isSystemError(e) && e.code === 'EXDEV') {
            await writeFile(appAsarPath, await readFile(updateAsarPath))
          } else {
            throw e
          }
        }
        await promisify(unlink)(appAsarPath + '.bk').catch(() => {})
        this.app.relaunch()
      } catch (e) {
        this.logger.error(
          new AnyError('UpdateError', `Fail to rename update the file: ${appAsarPath}`, {
            cause: e,
          }),
        )
        await promisify(rename)(appAsarPath + '.bk', appAsarPath)
      }
    }
  }

  async checkUpdateTask(): Promise<ReleaseInfo> {
    if (this.app.platform.os === 'windows' || this.app.platform.os === 'osx') {
      return this.#getUpdateFromSelfHost()
    }
    try {
      return await this.#getUpdateFromAutoUpdater()
    } catch (e) {
      if (isSystemError(e) && e.code === 'ENOENT') {
        return this.#getUpdateFromSelfHost()
      }
      this.logger.warn(e as Error)
      throw e
    }
  }

  async downloadUpdate(updateInfo: ReleaseInfo, options?: DownloadUpdateOptions): Promise<void> {
    const tracker = options?.tracker
    const abortSignal = options?.abortSignal

    if (updateInfo.operation === ElectronUpdateOperation.AutoUpdater) {
      await downloadFullUpdate(this.app, updater.autoUpdater, {
        tracker,
        abortSignal,
      })
    } else if (updateInfo.operation === ElectronUpdateOperation.Asar) {
      const updatePath = join(this.app.appDataPath, 'pending_update')
      await downloadAsarUpdate(this.app, updatePath, updateInfo.name, {
        tracker,
        abortSignal,
      })
    } else if (updateInfo.operation === ElectronUpdateOperation.Appx) {
      await downloadAppInstaller(this.app, { tracker, abortSignal })
    } else {
      tracker?.({
        phase: 'download-update.manual',
        payload: {},
      })
      await hintUserDownload()
    }
  }

  async installUpdateAndQuit(updateInfo: ReleaseInfo): Promise<void> {
    if (HAS_DEV_SERVER) {
      this.logger.log('Currently is development environment. Skip to install update')
      return
    }
    if (updateInfo.operation === ElectronUpdateOperation.Asar) {
      await this.quitAndInstallAsar()
    } else {
      updater.autoUpdater.quitAndInstall()
    }
  }
}
