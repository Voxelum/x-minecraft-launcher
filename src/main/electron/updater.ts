import { ChecksumNotMatchError, DownloadTask } from '@xmcl/installer'
import { task, Task, TaskBase } from '@xmcl/task'
import { spawn } from 'child_process'
import { autoUpdater, CancellationToken, Provider, UpdateInfo, UpdaterSignal } from 'electron-updater'
import { close, stat, writeFile } from 'fs-extra'
import got from 'got'
import { closeSync, existsSync, open, rename, unlink } from 'original-fs'
import { basename, dirname, join } from 'path'
import { SemVer } from 'semver'
import { URL } from 'url'
import { promisify } from 'util'
import { checksum } from '../util/fs'
import ElectronLauncherApp from './ElectronLauncherApp'
import { AZURE_CDN, AZURE_CDN_HOST, IS_DEV } from '/@main/constant'
import { UpdateInfo as _UpdateInfo } from '/@shared/entities/update'

/**
 * Only download asar file update.
 *
 * If the this update is not a full update but an incremental update,
 * you can call this to download asar update
 */
export class DownloadAsarUpdateTask extends DownloadTask {
  private sha256 = ''

  constructor(private updateInfo: UpdateInfo, private isInGFW: boolean, destination: string) {
    super({ url: '', destination })
  }

  protected async process() {
    const provider: Provider<UpdateInfo> = (await (autoUpdater as any).clientPromise)
    const files = provider.resolveFiles(this.updateInfo)

    const uObject = files[0].url
    uObject.pathname = `${uObject.pathname.substring(0, uObject.pathname.lastIndexOf('/') + 1)}app.asar`

    if (this.isInGFW) {
      uObject.host = AZURE_CDN_HOST
      uObject.hostname = AZURE_CDN_HOST
      uObject.pathname = 'releases/app.asar'
    }

    this.url = uObject.toString()
    this.originalUrl = this.url

    return super.process()
  }

  async shouldProcess() {
    const missed = await stat(this.destination).then(s => s.size === 0, () => false)
    if (missed) {
      return true
    }
    if (!this.sha256) {
      this.sha256 = await got(`${this.url}.sha256`).text().catch(() => '')
    }
    if (!this.sha256) {
      return true
    }
    const expect = this.sha256
    const actual = await checksum(this.destination, 'sha256')
    return expect !== actual
  }

  async validate() {
    if (this.sha256) {
      const expect = this.sha256
      const actual = await checksum(this.destination, 'sha256')
      if (actual !== expect) {
        throw new ChecksumNotMatchError('sha256', expect, actual, this.destination)
      }
    }
    await close(this.fd).catch(() => { })
    this.fd = -1
  }
}

/**
 * Download the full update. This size can be larger as it carry the whole electron thing...
 */
export class DownloadFullUpdateTask extends TaskBase<void> {
  private updateSignal = new UpdaterSignal(autoUpdater)

  private cancellationToken = new CancellationToken()

  protected async run(): Promise<void> {
    this.updateSignal.progress((info) => {
      this._progress = info.transferred
      this._total = info.total
      this.update(info.delta)
    })
    await autoUpdater.downloadUpdate(this.cancellationToken)
  }

  protected performCancel(): Promise<void> {
    this.cancellationToken.cancel()
    return new Promise((resolve) => {
      autoUpdater.once('update-cancelled', resolve)
    })
  }

  protected async performPause(): Promise<void> {
    this.cancellationToken.cancel()
  }

  protected performResume(): void {
    this.run()
  }
}

export async function quitAndInstallAsar(this: ElectronLauncherApp) {
  if (IS_DEV) {
    this.log('Currently is development envrionment. Skip to install ASAR')
    return
  }
  const exePath = process.argv[0]
  const appPath = dirname(exePath)

  const appAsarPath = join(appPath, 'resources', 'app.asar')
  const updateAsarPath = join(this.appDataPath, 'pending_update')

  this.log(`Install asar on ${this.platform.name}`)
  if (this.platform.name === 'windows') {
    const elevatePath = join(appPath, 'resources', 'elevate.exe')

    if (!existsSync(updateAsarPath)) {
      this.error(`No update found: ${updateAsarPath}`)
      throw new Error(`No update found: ${updateAsarPath}`)
    }
    if (!existsSync(elevatePath)) {
      this.error(`No elevate.exe found: ${elevatePath}`)
      throw new Error(`No elevate.exe found: ${elevatePath}`)
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
      'Start-Sleep -s 3',
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
  } else {
    await promisify(unlink)(appAsarPath)
    await promisify(rename)(updateAsarPath, appAsarPath)
  }
  this.quitApp()
}

export function quitAndInstallFullUpdate() {
  if (IS_DEV) {
    return
  }
  autoUpdater.quitAndInstall()
}

let injectedUpdate = false

export function checkUpdateTask(this: ElectronLauncherApp): Task<_UpdateInfo> {
  return task('checkUpdate', async () => {
    autoUpdater.once('update-available', () => {
      this.log('Update available and set status to pending')
      this.storeManager.store.commit('updateStatus', 'pending')
    })
    console.log('check update task')
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

    const updateInfo: _UpdateInfo = info.updateInfo as _UpdateInfo

    updateInfo.incremental = false
    const currentVersion = autoUpdater.currentVersion
    const newVersion = new SemVer(updateInfo.version)

    if (newVersion.major === currentVersion.major) {
      updateInfo.incremental = true
    }

    return updateInfo
  })
}
