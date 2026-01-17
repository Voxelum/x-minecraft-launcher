import {
  BaseServiceKey,
  type Environment,
  type BaseService as IBaseService,
  type InvalidDirectoryErrorCode,
  type MigrateOptions,
  MigrationException,
  type PoolStats,
  Settings,
  type SharedState,
  DownloadUpdateTask,
  NetworkStatus,
} from '@xmcl/runtime-api'
import { readdir, stat } from 'fs-extra'
import os, { freemem, totalmem } from 'os'
import { join } from 'path'
import { Inject, LauncherAppKey, kGameDataPath } from '~/app'
import { kClientToken, kGFW, kLogRoot } from '~/infra'
import { kNetworkInterface } from '~/network'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { kSettings } from '~/settings'
import { type Tasks, kTasks } from '~/infra'
import { validateDirectory } from '~/util/validate'
import { writeZipFile } from '../util/zip'
import { LauncherApp } from '../app/LauncherApp'
import { HAS_DEV_SERVER } from '../constant'
import { ZipFile } from 'yazl'
import { getTracker } from '~/util/taskHelper'

@ExposeServiceKey(BaseServiceKey)
export class BaseService extends AbstractService implements IBaseService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTasks) private tasks: Tasks,
  ) {
    super(app, async () => {
      this.checkUpdate()
    })
  }

  async getDesktopDirectory(): Promise<string> {
    return this.app.host.getPath('desktop')
  }

  destroyPool(origin: string) {
    return this.app.registry.get(kNetworkInterface).then((s) => s.destroyPool(origin))
  }

  getNetworkStatus(): Promise<NetworkStatus> {
    return this.app.registry.get(kNetworkInterface).then((s) => s.getNetworkStatus())
  }

  getSessionId() {
    return this.app.registry.get(kClientToken)
  }

  getGameDataDirectory(): Promise<string> {
    return this.app.registry.get(kGameDataPath).then((f) => f())
  }

  async getSettings(): Promise<SharedState<Settings>> {
    return this.app.registry.get(kSettings)
  }

  async getEnvironment(): Promise<Environment> {
    const gfw = await this.app.registry.get(kGFW)
    await gfw.signal
    return {
      os: this.app.platform.os,
      arch: this.app.platform.arch,
      osRelease: this.app.platform.osRelease,
      env: this.app.env,
      version: this.app.version,
      build: this.app.build,
      region: this.app.systemLocale,
      gfw: gfw.inside,
      gpu: await this.app.host
        .getGPUInfo('basic')
        .then(
          (info) =>
            info.gpuDevice?.some(
              (g) => g.vendorId === 4318 || g.vendorId === 4098 || g.vendorId === 4203,
            ) ?? false,
        ),
    }
  }

  async makeDesktopShortcut() {
    const desktopDir = this.app.host.getPath('desktop')
    if (process.platform === 'win32') {
      const shortcutPath = join(desktopDir, 'X Minecraft Launcher.lnk')
      return this.app.shell.createShortcut(shortcutPath, {
        target: this.app.host.getPath('exe'),
        args: process.execArgv.join(' '),
        cwd: process.cwd(),
      })
    }
    return false
  }

  async handleUrl(url: string) {
    this.emit('url-drop', url)
    const response = await this.app.protocol.handle({ url })
    if (response.status >= 200 && response.status < 300) {
      return true
    }
    return false
  }

  /**
   * A electron provided function to show item in directory
   * @param item The path to the file item
   */
  showItemInDirectory(item: string) {
    this.app.shell.showItemInFolder(item)
  }

  /**
   * A safe method that only open directory. If the `path` is a file, it won't execute it.
   * @param path The directory path.
   */
  openDirectory(path: string) {
    return this.app.shell.openDirectory(path)
  }

  /**
   * Quit and install the update once the update is ready
   */
  @Singleton()
  async quitAndInstall() {
    const settings = await this.getSettings()
    if (settings.updateStatus === 'ready' && settings.updateInfo) {
      await this.app.updater.installUpdateAndQuit(settings.updateInfo)
    } else {
      this.warn('There is no update available!')
    }
  }

  /**
   * Check launcher update.
   */
  @Singleton()
  async checkUpdate() {
    if (HAS_DEV_SERVER) return
    try {
      const settings = await this.getSettings()
      this.log('Check update')
      const info = await this.app.updater.checkUpdateTask()
      settings.updateInfoSet(info)
      if (info.newUpdate) {
        settings.updateStatusSet('pending')
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'Error') {
        if (e.message === 'No update info found') {
          return
        }
        e.name = 'CheckUpdateError'
      }
      throw e
    }
  }

  /**
   * Download the update if there is available update
   */
  @Singleton()
  async downloadUpdate() {
    const settings = await this.getSettings()
    if (!settings.updateInfo) {
      throw new Error("Cannot download update if we don't check the version update!")
    }
    const updateInfo = settings.updateInfo

    this.log(`Start to download update: ${updateInfo.name} operation=${updateInfo.operation}`)
    const task = this.tasks.create<DownloadUpdateTask>({
      type: 'downloaUpdate',
      key: `download-update-${updateInfo.operation}`,
      operation: updateInfo.operation as 'autoupdater' | 'asar' | 'appx' | 'manual',
      version: updateInfo.name,
    })
    await task.wrap(this.app.updater.downloadUpdate(updateInfo, {
      tracker: getTracker(task),
    }))
    settings.updateStatusSet('ready')
  }

  quit() {
    return this.app.quit()
  }

  exit(code?: number) {
    this.app.exit(code)
  }

  async reportItNow(options: { destination: string }): Promise<void> {
    const zipFile = new ZipFile()
    const logsDir = await this.app.registry.get(kLogRoot)
    const files = await readdir(logsDir)

    for (const file of files) {
      const fStat = await stat(join(logsDir, file)).catch(() => undefined)
      if (fStat?.isFile()) {
        zipFile.addFile(join(logsDir, file), join('logs', file))
      }
    }

    const sessionId = await this.app.registry.get(kClientToken)

    zipFile.addBuffer(
      Buffer.from(
        JSON.stringify({
          sessionId,
          platform: os.platform(),
          arch: os.arch(),
          version: os.version(),
          release: os.release(),
          type: os.type(),
        }),
      ),
      'device.json',
    )
    await writeZipFile(zipFile, options.destination)

    this.showItemInDirectory(options.destination)
  }

  async migrate(options: MigrateOptions) {
    const destination = options.destination
    const code = await validateDirectory(this.app.platform, destination)
    if (code) {
      throw new MigrationException({
        type: 'migrationInvalidDestiantion',
        code,
        destination,
      })
    }

    this.app.relaunch([...process.argv.slice(1), '--migrate', destination])
    this.app.quit()
  }

  async validateDataDictionary(path: string): Promise<InvalidDirectoryErrorCode> {
    return await validateDirectory(this.app.platform, path)
  }

  getMemoryStatus(): Promise<{ total: number; free: number }> {
    return Promise.resolve({
      total: totalmem(),
      free: freemem(),
    })
  }
}
