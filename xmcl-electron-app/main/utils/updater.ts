import { AZURE_CDN, AZURE_MS_CDN, BUILTIN_TRUSTED_SITES, HAS_DEV_SERVER } from '@/constant'
import { ChecksumNotMatchError, resolveRangePolicy } from '@xmcl/file-transfer'
import { DownloadTask } from '@xmcl/installer'
import { ReleaseInfo } from '@xmcl/runtime-api'
import { LauncherAppUpdater } from '@xmcl/runtime/app'
import { BaseService } from '@xmcl/runtime/base'
import { GFW } from '@xmcl/runtime/gfw'
import { Logger } from '@xmcl/runtime/logger'
import { AbortableTask, BaseTask, Task, task } from '@xmcl/task'
import { spawn } from 'child_process'
import { shell } from 'electron'
import { CancellationToken, Provider, UpdateInfo, UpdaterSignal, autoUpdater } from 'electron-updater'
import { readFile, writeFile } from 'fs-extra'
import { closeSync, existsSync, open, rename, unlink } from 'original-fs'
import { platform } from 'os'
import { basename, dirname, join } from 'path'
import { SemVer } from 'semver'
import { promisify } from 'util'
import { JavaService } from '~/java'
import { AnyError, isSystemError } from '~/util/error'
import ElectronLauncherApp from '../ElectronLauncherApp'
import { DownloadAppInstallerTask } from './appinstaller'
import { ensureElevateExe } from './elevate'
import { checksum } from '~/util/fs'
// @ts-ignore
import UpdaterBinary from './AutoUpdate.class'
import { kDownloadOptions } from '~/network'

/**
 * Only download asar file update.
 *
 * If the this update is not a full update but an incremental update,
 * you can call this to download asar update
 */
export class DownloadAsarUpdateTask extends DownloadTask {
  constructor(private app: ElectronLauncherApp, destination: string, version: string) {
    let sha256 = ''
    version = version.startsWith('v') ? version.substring(1) : version
    const pl = platform()
    let platformFlag = pl === 'win32' ? 'win' : pl === 'darwin' ? 'mac' : 'linux'
    if (process.arch === 'arm64') {
      platformFlag += '-arm64'
    } else if (process.arch === 'ia32') {
      platformFlag += '-ia32'
    }
    super({
      url: [
        `${AZURE_CDN}/app-${version}-${platformFlag}.asar`,
        `${AZURE_MS_CDN}/app-${version}-${platformFlag}.asar`,
      ],
      destination,
      rangePolicy: resolveRangePolicy({
        rangeThreshold: 1000 * 1024 * 1024,
      }),
      validator: {
        async validate(file, url) {
          if (!sha256) {
            const response = await app.fetch(`${url}.sha256`)
            sha256 = await response.text().catch(() => '')
          }
          if (!sha256 || sha256.length !== 64) {
            throw new ChecksumNotMatchError('sha256', '', '', file, url)
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

  protected async process(): Promise<void> {
    const op = await this.app.registry.get(kDownloadOptions)
    this.options.dispatcher = op.dispatcher
    return super.process()
  }
}

export class DownloadAsarUpdateFetchTask extends AbortableTask<void> {
  urls: string[] = []
  controller: AbortController = new AbortController()

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
    this.urls = [
      `${AZURE_CDN}/app-${version}-${platformFlag}.asar`,
      `${AZURE_MS_CDN}/app-${version}-${platformFlag}.asar`,
    ]
  }

  protected async process(): Promise<void> {
    this.controller = new AbortController()
    const resp = await this.app.fetch(this.urls[0])
    const buf = await resp.arrayBuffer()
    return writeFile(this.destination, Buffer.from(buf))
  }

  protected abort(isCancelled: boolean): void {
    this.controller.abort(Object.assign(new Error(), { name: 'AbortError' }))
  }

  protected isAbortedError(e: any): boolean {
    return e.name === 'AbortError'
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
    return new Promise<any>((resolve) => {
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

async function getUpdateAsarViaJavaArgs(appAsarPath: string, updateAsarPath: string, app: ElectronLauncherApp) {
  const serv = await app.registry.get(JavaService)
  const java = serv.state.all.find(v => v.valid)?.path
  if (!java) return false

  const javawPath = join(dirname(java), 'javaw.exe')

  await writeFile(join(app.appDataPath, 'AutoUpdate.class'), UpdaterBinary)
  const args = [
    existsSync(javawPath) ? javawPath : java,
    'AutoUpdate',
    updateAsarPath,
    appAsarPath,
    process.argv[0],
  ]

  return args
}

async function getUpdateAsarViaPowerShellArgs(appAsarPath: string, updateAsarPath: string, app: ElectronLauncherApp) {
  const psPath = join(app.appDataPath, 'AutoUpdate.ps1')
  let startProcessCmd = `Start-Process -FilePath "${process.argv[0]}"`
  if (process.argv.slice(1).length > 0) {
    startProcessCmd += ` -ArgumentList ${process.argv.slice(1).map((s) => `"${s}"`).join(', ')}`
  }
  startProcessCmd += ` -WorkingDirectory "${process.cwd()}"`
  await writeFile(psPath, [
    'Start-Sleep -s 1',
    `Copy-Item -Path "${updateAsarPath}" -Destination "${appAsarPath}" -force`,
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

  return args
}

export class ElectronUpdater implements LauncherAppUpdater {
  private logger: Logger

  constructor(private app: ElectronLauncherApp) {
    this.logger = app.getLogger('ElectronUpdater')
  }

  private async getUpdateFromSelfHost(): Promise<ReleaseInfo> {
    const app = this.app
    this.logger.log('Try get update from selfhost')
    const baseService = await app.registry.get(BaseService)
    const { allowPrerelease, locale } = await baseService.getSettings()
    const url = `https://api.xmcl.app/latest?version=v${app.version}&prerelease=${allowPrerelease || false}`
    const response = await this.app.fetch(url, {
      headers: {
        'Accept-Language': locale,
      },
    }).catch(() => fetch('https://xmcl.blob.core.windows.net/releases/latest_version.json'))
    const result = await response.json() as any
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
    const platformString = app.platform.os === 'windows' ? 'win' : app.platform.os === 'osx' ? 'mac' : 'linux'
    const version = updateInfo.name.startsWith('v') ? updateInfo.name.substring(1) : updateInfo.name
    updateInfo.incremental = updateInfo.files.some(f => f.name === `app-${version}-${platformString}.asar`)
    this.logger.log(`Got incremental=${updateInfo.incremental} update from selfhost`)

    return updateInfo
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

      let args: string[]

      const jArgs = await getUpdateAsarViaJavaArgs(appAsarPath, updateAsarPath, this.app)
      if (!jArgs) {
        args = await getUpdateAsarViaPowerShellArgs(appAsarPath, updateAsarPath, this.app)
        if (!hasWriteAccess) {
          args.unshift(elevatePath)
        }
      } else {
        args = jArgs
      }

      args = args.map(s => '"' + s + '"')
      this.logger.log(`Install from windows: ${args.join(' ')}`)
      const x = spawn(args[0], args.slice(1), {
        cwd: this.app.appDataPath,
        detached: true,
        shell: true,
        stdio: 'ignore',
      })
      x.on('exit', (code) => {
        this.logger.log(`Java Exit with code ${code}`)
      })
      x.on('error', (e) => {
        this.logger.error(e)
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
      try {
        if (this.app.env === 'appx') {
          return this.getUpdateFromSelfHost()
        }

        let newUpdate = false
        autoUpdater.once('update-available', () => {
          this.logger.log('Update available and set status to pending')
          if (release) {
            release.newUpdate = true
          } else {
            newUpdate = true
          }
        })
        this.logger.log(`Check update via ${autoUpdater.getFeedURL()}`)
        const gfw = await this.app.registry.get(GFW)
        const info = await autoUpdater.checkForUpdates()
        if (!info) throw new Error('No update info found')
        if (await gfw.signal && !injectedUpdate) {
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
          newUpdate,
          incremental: newVersion.major === currentVersion.major,
        }

        release.incremental = release.files.some(f => f.name.endsWith('.asar'))

        return release
      } catch (e) {
        return this.getUpdateFromSelfHost()
      }
    })
  }

  downloadUpdateTask(updateInfo: ReleaseInfo): Task<void> {
    if (this.app.platform.os === 'linux') {
      if (updateInfo.useAutoUpdater) {
        return new DownloadFullUpdateTask()
      }
    }
    if (this.app.env === 'appx') {
      this.logger.log('Download appx from selfhost')
      return new DownloadAppInstallerTask(this.app)
    }
    if (updateInfo.incremental && this.app.env === 'raw') {
      this.logger.log('Download asar from selfhost')
      const updatePath = join(this.app.appDataPath, 'pending_update')
      return new DownloadAsarUpdateTask(this.app, updatePath, updateInfo.name)
        .map(() => undefined)
    }
    if (updateInfo.useAutoUpdater) {
      return new DownloadFullUpdateTask()
    }
    return new HintUserDownloadTask()
  }

  async installUpdateAndQuit(updateInfo: ReleaseInfo): Promise<void> {
    if (HAS_DEV_SERVER) {
      this.logger.log('Currently is development environment. Skip to install update')
      return
    }
    if (updateInfo.incremental) {
      await this.quitAndInstallAsar()
    } else {
      autoUpdater.quitAndInstall()
    }
  }
}

let injectedUpdate = false
