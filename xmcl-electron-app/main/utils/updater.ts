import { AZURE_MS_CDN, HAS_DEV_SERVER } from '@/constant'
import { ElectronUpdateOperation, ReleaseInfo } from '@xmcl/runtime-api'
import { LauncherAppUpdater } from '@xmcl/runtime/app'
import { BaseService } from '@xmcl/runtime/base'
import { Logger } from '@xmcl/runtime/logger'
import { AbortableTask, BaseTask, Task, task } from '@xmcl/task'
import { spawn } from 'child_process'
import { shell } from 'electron'
import { AppUpdater, CancellationToken, Provider, UpdateInfo, UpdaterSignal, autoUpdater } from 'electron-updater'
import { createWriteStream } from 'fs'
import { readFile, writeFile } from 'fs-extra'
import { closeSync, existsSync, open, rename, unlink } from 'original-fs'
import { platform } from 'os'
import { basename, dirname, join } from 'path'
import { PassThrough, Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'
import { createGunzip } from 'zlib'
import { AnyError, isSystemError } from '~/util/error'
import { checksum } from '~/util/fs'
import ElectronLauncherApp from '../ElectronLauncherApp'
import { DownloadAppInstallerTask } from './appinstaller'
import { ensureElevateExe } from './elevate'

const kPatched = Symbol('Patched')
// @ts-ignore
const getUpdateInfoAndProvider = AppUpdater.prototype.getUpdateInfoAndProvider
// @ts-ignore
AppUpdater.prototype.getUpdateInfoAndProvider = async function (this: AppUpdater) {
  const result = await getUpdateInfoAndProvider.call(this)
  const provider = result.provider

  if (kPatched in provider) {
    return result
  }

  const resolveFiles = provider.resolveFiles
  Object.assign(provider, {
    [kPatched]: true,
    resolveFiles: function (this: Provider<UpdateInfo>, inf: UpdateInfo) {
      const result = resolveFiles.call(provider, inf)
      return result.map((i) => {
        const pathname = i.url.pathname
        return {
          ...i,
          url: new URL(`${AZURE_MS_CDN}/${basename(pathname)}`),
        }
      })
    },
  })
  return result
}

/**
 * Only download asar file update.
 *
 * If the this update is not a full update but an incremental update,
 * you can call this to download asar update
 */
export class DownloadAsarUpdateTask extends AbortableTask<void> {
  private url: string
  private abortController = new AbortController()

  constructor(private app: ElectronLauncherApp, private destination: string, version: string) {
    super()
    version = version.startsWith('v') ? version.substring(1) : version
    const pl = platform()
    let platformFlag = pl === 'win32' ? 'win' : pl === 'darwin' ? 'mac' : 'linux'
    if (process.arch === 'arm64') {
      platformFlag += '-arm64'
    } else if (process.arch === 'ia32') {
      platformFlag += '-ia32'
    }
    this.url = `${AZURE_MS_CDN}/app-${version}-${platformFlag}.asar`
  }

  protected async process(): Promise<void> {
    this.abortController = new AbortController()
    const sha256Response = await this.app.fetch(this.url + '.sha256', { signal: this.abortController.signal })
    const sha256 = sha256Response.ok ? await sha256Response.text() : ''
    const actual = await checksum(this.destination, 'sha256').catch(() => '')
    if (sha256 === actual) {
      return
    }
    const gzUrl = this.url + '.gz'
    const gzResponse = await fetch(gzUrl, { signal: this.abortController.signal })
    const tracker = new PassThrough({
      transform: (chunk, encoding, callback) => {
        this._progress += chunk.length
        this.update(chunk.length)
        callback(undefined, chunk)
      },
    })
    if (gzResponse.ok && gzResponse.body) {
      this._total = parseInt(gzResponse.headers.get('Content-Length') || '0', 10)
      await pipeline(Readable.fromWeb(gzResponse.body as any), createGunzip(), tracker, createWriteStream(this.destination))
    } else {
      const response = await this.app.fetch(this.url, { signal: this.abortController.signal })
      if (!response.ok) {
        throw new AnyError('DownloadError', `Fail to download asar update from ${this.url}`, {}, { status: response.status })
      }
      this._total = parseInt(response.headers.get('Content-Length') || '0', 10)
      await pipeline(Readable.fromWeb(response.body as any), tracker, createWriteStream(this.destination))
    }
  }

  protected abort(isCancelled: boolean): void {
    this.abortController.abort(Object.assign(new Error(), { name: 'AbortError' }))
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof Error && e.name === 'AbortError'
  }
}

export class HintUserDownloadTask extends BaseTask<void> {
  protected async runTask(): Promise<void> {
    shell.openExternal('https://xmcl.app')
  }

  protected async cancelTask(): Promise<void> {
  }

  protected async pauseTask(): Promise<void> {
  }

  protected async resumeTask(): Promise<void> {
  }
}

async function getUpdateAsarViaBatArgs(appAsarPath: string, updateAsarPath: string, appDataPath: string, elevatePath?: string): Promise<string[]> {
  const psPath = join(appDataPath, 'AutoUpdate.bat')
  await writeFile(psPath, [
    '@echo off',
    'chcp 65001',
    '%WinDir%\\System32\\timeout.exe 2',
    `taskkill /f /im "${basename(process.argv[0])}"`,
    `copy /Y "${updateAsarPath}" "${appAsarPath}"`,
    `start /b "" /d "${process.cwd()}" ${process.argv.map((s) => `"${s}"`).join(' ')}`,
  ].join('\r\n'))

  return elevatePath
    ? [
      elevatePath,
      psPath,
    ]
    : [
      'cmd.exe',
      '/c',
      psPath,
    ]
}
/**
 * Download the full update. This size can be larger as it carry the whole electron thing...
 */
export class DownloadFullUpdateTask extends AbortableTask<void> {
  private updateSignal = new UpdaterSignal(autoUpdater)

  private cancellationToken = new CancellationToken()

  protected async process(): Promise<void> {
    this.cancellationToken = new CancellationToken()
    this.updateSignal.progress((info) => {
      this._progress = info.transferred
      this._total = info.total
      this.update(info.delta)
    })
    await autoUpdater.downloadUpdate(this.cancellationToken)
  }

  protected abort(): void {
    this.cancellationToken.cancel()
  }

  protected isAbortedError(e: any): boolean {
    return e.name === 'CancellationError'
  }
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
    const baseService = await app.registry.get(BaseService)
    const { allowPrerelease, locale } = await baseService.getSettings()
    const url = `https://api.xmcl.app/latest?version=v${app.version}&prerelease=${allowPrerelease || false}`
    const response = await this.app.fetch(url, {
      headers: {
        'Accept-Language': locale,
      },
    })
    const result = await response.json() as any
    const files = result.assets.map((a: any) => ({ url: a.browser_download_url, name: a.name })) as Array<{ url: string; name: string }>
    const platformString = app.platform.os === 'windows' ? 'win' : app.platform.os === 'osx' ? 'mac' : 'linux'
    const version = result.tag_name.substring(1)
    const updateInfo: ReleaseInfo = {
      name: result.tag_name,
      body: result.body,
      date: result.published_at,
      files,
      newUpdate: !isSameVersion(app.version, result.tag_name),
      operation: ElectronUpdateOperation.Manual,
    }

    const hasAsar = files.some(f => f.name === `app-${version}-${platformString}.asar`)
    if (this.app.platform.os === 'windows') {
      if (this.app.env === 'appx') {
        updateInfo.operation = ElectronUpdateOperation.Appx
      } else {
        updateInfo.operation = hasAsar ? ElectronUpdateOperation.Asar : ElectronUpdateOperation.Manual
      }
    } else if (this.app.platform.os === 'osx') {
      updateInfo.operation = hasAsar ? ElectronUpdateOperation.Asar : ElectronUpdateOperation.Manual
    } else {
      updateInfo.operation = (hasAsar && this.app.env !== 'appimage') ? ElectronUpdateOperation.Asar : ElectronUpdateOperation.Manual
    }

    this.logger.log(`Got operation=${updateInfo.operation} update from selfhost`)

    return updateInfo
  }

  async #getUpdateFromAutoUpdater(): Promise<ReleaseInfo> {
    this.logger.log(`Check update via ${autoUpdater.getFeedURL()}`)
    const info = await autoUpdater.checkForUpdates()
    if (!info) throw new Error('No update info found')

    const files = info.updateInfo.files.map(f => ({ name: basename(f.url), url: f.url }))
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
      this.logger.log(hasWriteAccess ? `Process has write access to ${appAsarPath}` : `Process does not have write access to ${appAsarPath}`)

      const args = await getUpdateAsarViaBatArgs(appAsarPath, updateAsarPath, this.app.appDataPath, !hasWriteAccess ? elevatePath : undefined)
      this.logger.log(`Install from windows: ${args.join(' ')}`)
      const x = spawn(args[0], args.slice(1), {
        cwd: this.app.appDataPath,
        detached: true,
        stdio: 'ignore',
      })
      x.unref()
      this.app.quit()
    } else {
      await promisify(rename)(appAsarPath, appAsarPath + '.bk').catch(() => { })
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
        await promisify(unlink)(appAsarPath + '.bk').catch(() => { })
        this.app.relaunch()
      } catch (e) {
        this.logger.error(new AnyError('UpdateError', `Fail to rename update the file: ${appAsarPath}`, { cause: e }))
        await promisify(rename)(appAsarPath + '.bk', appAsarPath)
      }
    }
  }

  checkUpdateTask(): Task<ReleaseInfo> {
    return task('checkUpdate', async () => {
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
    })
  }

  downloadUpdateTask(updateInfo: ReleaseInfo): Task<void> {
    if (updateInfo.operation === ElectronUpdateOperation.AutoUpdater) {
      return new DownloadFullUpdateTask()
    } else if (updateInfo.operation === ElectronUpdateOperation.Asar) {
      const updatePath = join(this.app.appDataPath, 'pending_update')
      return new DownloadAsarUpdateTask(this.app, updatePath, updateInfo.name)
    } else if (updateInfo.operation === ElectronUpdateOperation.Appx) {
      return new DownloadAppInstallerTask(this.app)
    }
    return new HintUserDownloadTask()
  }

  async installUpdateAndQuit(updateInfo: ReleaseInfo): Promise<void> {
    if (HAS_DEV_SERVER) {
      this.logger.log('Currently is development environment. Skip to install update')
      return
    }
    if (updateInfo.operation === ElectronUpdateOperation.Asar) {
      await this.quitAndInstallAsar()
    } else {
      autoUpdater.quitAndInstall()
    }
  }
}
