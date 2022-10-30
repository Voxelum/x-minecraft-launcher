import { AZURE_CDN, AZURE_MS_CDN, IS_DEV } from '@/constant'
import { ChecksumNotMatchError, download, DownloadTask } from '@xmcl/installer'
import { BaseService, ServiceStateManager } from '@xmcl/runtime'
import { ReleaseInfo } from '@xmcl/runtime-api'
import { BaseTask, task, Task } from '@xmcl/task'
import { spawn } from 'child_process'
import { autoUpdater, CancellationToken, Provider, UpdateInfo, UpdaterSignal } from 'electron-updater'
import { stat, writeFile } from 'fs-extra'
import { request } from 'undici'
import { closeSync, existsSync, open, rename, unlink } from 'original-fs'
import { platform } from 'os'
import { basename, dirname, join } from 'path'
import { SemVer } from 'semver'
import { URL } from 'url'
import { promisify } from 'util'
import ElectronLauncherApp from '../ElectronLauncherApp'
import { checksum } from './fs'

/**
 * Only download asar file update.
 *
 * If the this update is not a full update but an incremental update,
 * you can call this to download asar update
 */
export class DownloadAsarUpdateTask extends DownloadTask {
  constructor(destination: string, version: string) {
    let sha256 = ''
    version = version.startsWith('v') ? version.substring(1) : version
    const pl = platform()
    const platformFlat = pl === 'win32' ? 'win' : pl === 'darwin' ? 'mac' : 'linux'
    super({
      url: [
        `${AZURE_CDN}/app-${version}-${platformFlat}.asar`,
        `${AZURE_MS_CDN}/app-${version}-${platformFlat}.asar`,
      ],
      destination,
      validator: {
        async validate(fd, file, url) {
          const missed = await stat(file).then(s => s.size === 0, () => false)
          if (missed) {
            return
          }
          if (!sha256) {
            const response = await request(`${url}.sha256`, { throwOnError: true })
            sha256 = await response.body.text().catch(() => '')
          }
          if (!sha256 || sha256.length !== 64) {
            return
          }
          const expect = sha256
          const actual = await checksum(file, 'sha256')
          if (expect !== actual) {
            throw new ChecksumNotMatchError('sha256', expect, actual, file, url)
          }
        },
      },
    })
  }
}

/**
 * Download the full update. This size can be larger as it carry the whole electron thing...
 */
export class DownloadFullUpdateTask extends BaseTask<void> {
  private updateSignal = new UpdaterSignal(autoUpdater)

  private cancellationToken = new CancellationToken()

  protected async runTask(): Promise<void> {
    this.updateSignal.progress((info) => {
      this._progress = info.transferred
      this._total = info.total
      this.update(info.delta)
    })
    await autoUpdater.downloadUpdate(this.cancellationToken)
  }

  protected cancelTask(): Promise<void> {
    this.cancellationToken.cancel()
    return new Promise((resolve) => {
      autoUpdater.once('update-cancelled', resolve)
    })
  }

  protected async pauseTask(): Promise<void> {
    this.cancellationToken.cancel()
  }

  protected resumeTask(): Promise<void> {
    // this.runRunt()
    return Promise.resolve()
  }
}

async function ensureElevateExe(app: ElectronLauncherApp) {
  const elevate = join(app.appDataPath, 'elevate.exe')
  await download({
    url: [
      `${AZURE_CDN}/elevate.exe`,
      `${AZURE_MS_CDN}/elevate.exe`,
    ],
    validator: {
      algorithm: 'sha1',
      hash: 'd8d449b92de20a57df722df46435ba4553ecc802',
    },
    destination: elevate,
  })
  return elevate
}

export async function quitAndInstallAsar(this: ElectronLauncherApp) {
  if (IS_DEV) {
    this.log('Currently is development environment. Skip to install ASAR')
    return
  }
  const appAsarPath = dirname(__dirname)
  const updateAsarPath = join(this.appDataPath, 'pending_update')

  this.log(`Install asar on ${this.platform.name} ${appAsarPath}`)
  if (this.platform.name === 'windows') {
    const elevatePath = await ensureElevateExe(this)

    if (!existsSync(updateAsarPath)) {
      this.error(`No update found: ${updateAsarPath}`)
      throw new Error(`No update found: ${updateAsarPath}`)
    }
    const psPath = join(this.appDataPath, 'AutoUpdate.ps1')
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

    this.log(hasWriteAccess ? `Process has write access to ${appAsarPath}` : `Process does not have write access to ${appAsarPath}`)
    let startProcessCmd = `Start-Process -FilePath "${process.argv[0]}"`
    if (process.argv.slice(1).length > 0) {
      startProcessCmd += ` -ArgumentList ${process.argv.slice(1).map((s) => `"${s}"`).join(', ')}`
    }
    startProcessCmd += ` -WorkingDirectory ${process.cwd()}`
    await writeFile(psPath, [
      'Start-Sleep -s 1',
      `Copy-Item -Path "${updateAsarPath}" -Destination "${appAsarPath}"`,
      `Remove-Item -Path "${updateAsarPath}"`,
      startProcessCmd,
    ].join('\r\n'))

    const args = [
      'powershell.exe',
      '-ExecutionPolicy',
      'RemoteSigned',
      '-File',
      `"${psPath}"`,
    ]
    if (!hasWriteAccess) {
      args.unshift(elevatePath)
    }
    this.log(`Install from windows: ${args.join(' ')}`)
    this.log(`Relaunch the process by: ${startProcessCmd}`)

    spawn(args[0], args.slice(1), {
      detached: true,
    }).on('error', (e) => {
      this.error(e)
    }).on('exit', (code, s) => {
      this.log(`Update process exit ${code}`)
    }).unref()
    this.quit()
  } else {
    await promisify(rename)(appAsarPath, appAsarPath + '.bk').catch(() => { })
    try {
      await promisify(rename)(updateAsarPath, appAsarPath)
      await promisify(unlink)(appAsarPath + '.bk').catch(() => { })
      this.relaunch()
    } catch (e) {
      this.error(`Fail to rename update the file: ${appAsarPath}`)
      this.error(e)
      await promisify(rename)(appAsarPath + '.bk', appAsarPath)
    }
  }
}

export function quitAndInstallFullUpdate() {
  if (IS_DEV) {
    return
  }
  autoUpdater.quitAndInstall()
}

let injectedUpdate = false

async function getUpdateFromSelfHost(app: ElectronLauncherApp): Promise<ReleaseInfo> {
  const { allowPrerelease, locale } = app.serviceManager.get(BaseService).state
  const url = `https://api.xmcl.app/latest?version=v${app.version}&prerelease=${allowPrerelease || false}`
  const response = await request(url, {
    headers: {
      'Accept-Language': locale,
    },
    throwOnError: true,
  }).catch(() => request('https://xmcl.blob.core.windows.net/releases/latest_version.json'))
  const result = await response.body.json()
  const updateInfo: ReleaseInfo = {
    name: result.tag_name,
    body: result.body,
    date: result.published_at,
    files: result.assets.map((a: any) => ({ url: a.browser_download_url, name: a.name })),
    newUpdate: true,
    useAutoUpdater: false,
    incremental: true,
  }
  updateInfo.newUpdate = `v${app.version}` !== updateInfo.name
  const platformString = app.platform.name === 'windows' ? 'win' : app.platform.name === 'osx' ? 'mac' : 'linux'
  const version = updateInfo.name.startsWith('v') ? updateInfo.name.substring(1) : updateInfo.name
  updateInfo.incremental = updateInfo.files.some(f => f.name === `app-${version}-${platformString}.asar`)

  return updateInfo
}

export function checkUpdateTask(this: ElectronLauncherApp): Task<ReleaseInfo> {
  return task('checkUpdate', async () => {
    try {
      let newUpdate = false
      autoUpdater.once('update-available', () => {
        this.log('Update available and set status to pending')
        if (release) {
          release.newUpdate = true
        } else {
          newUpdate = true
        }
      })
      this.log(`Check update via ${autoUpdater.getFeedURL()}`)
      const info = await autoUpdater.checkForUpdates()
      if (this.networkManager.isInGFW && !injectedUpdate) {
        injectedUpdate = true
        const provider: Provider<UpdateInfo> = (await (autoUpdater as any).clientPromise)
        const originalResolve = provider.resolveFiles
        provider.resolveFiles = function (this: Provider<UpdateInfo>, inf: UpdateInfo) {
          const result = originalResolve.bind(provider)(inf)
          result.forEach((i) => {
            const pathname = i.url.pathname;
            (i as any).url = new URL(`${AZURE_CDN}/${basename(pathname)}`)
          })
          return result
        }
      }

      const currentVersion = autoUpdater.currentVersion
      const newVersion = new SemVer(info.updateInfo.version)

      const release = {
        name: info.updateInfo.version,
        body: (info.updateInfo.releaseNotes ?? '') as string,
        date: info.updateInfo.releaseDate,
        files: info.updateInfo.files.map(f => ({ name: basename(f.url), url: f.url })),
        useAutoUpdater: true,
        newUpdate: newUpdate,
        incremental: newVersion.major === currentVersion.major,
      }

      release.incremental = release.files.some(f => f.name.endsWith('.asar'))

      return release
    } catch (e) {
      return getUpdateFromSelfHost(this)
    }
  })
}

export function setup(storeManager: ServiceStateManager) {
  storeManager.subscribe('autoInstallOnAppQuitSet', (value) => {
    autoUpdater.autoInstallOnAppQuit = value
  }).subscribe('allowPrereleaseSet', (value) => {
    autoUpdater.allowPrerelease = value
  }).subscribe('autoDownloadSet', (value) => {
    autoUpdater.autoDownload = value
  }).subscribe('config', (config) => {
    autoUpdater.autoInstallOnAppQuit = config.autoInstallOnAppQuit
    autoUpdater.allowPrerelease = config.allowPrerelease
    autoUpdater.autoDownload = config.autoDownload
  })
}
