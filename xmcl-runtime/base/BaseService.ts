import { BaseServiceException, BaseServiceKey, Environment, BaseService as IBaseService, MigrateOptions, MutableState, PoolStats, Settings } from '@xmcl/runtime-api'
import { readdir, rename, stat } from 'fs-extra'
import os, { freemem, totalmem } from 'os'
import { join } from 'path'
import { Inject, LauncherAppKey, kGameDataPath } from '~/app'
import { kClientToken } from '~/clientToken'
import { kLogRoot } from '~/logger'
import { kNetworkInterface } from '~/network'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { kSettings } from '~/settings'
import { TaskFn, kTaskExecutor } from '~/task'
import { validateDirectory } from '~/util/validate'
import { LauncherApp } from '../app/LauncherApp'
import { HAS_DEV_SERVER } from '../constant'
import { AnyError, isSystemError } from '../util/error'
import { copyPassively } from '../util/fs'
import { ZipTask } from '../util/zip'

@ExposeServiceKey(BaseServiceKey)
export class BaseService extends AbstractService implements IBaseService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTaskExecutor) private submit: TaskFn,
  ) {
    super(app, async () => {
      this.checkUpdate()
    })
  }

  destroyPool(origin: string) {
    return this.app.registry.get(kNetworkInterface).then(s => s.destroyPool(origin))
  }

  getNetworkStatus(): Promise<Record<string, PoolStats>> {
    return this.app.registry.get(kNetworkInterface).then(s => s.getDownloadAgentStatus())
  }

  getSessionId() {
    return this.app.registry.get(kClientToken)
  }

  getGameDataDirectory(): Promise<string> {
    return this.app.registry.get(kGameDataPath).then(f => f())
  }

  async getSettings(): Promise<MutableState<Settings>> {
    return this.app.registry.get(kSettings)
  }

  async getEnvironment(): Promise<Environment> {
    return {
      os: this.app.platform.os,
      arch: this.app.platform.arch,
      osRelease: this.app.platform.osRelease,
      env: this.app.env,
      version: this.app.version,
      build: this.app.build,
    }
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
      const info = await this.submit(this.app.updater.checkUpdateTask())
      settings.updateInfoSet(info)
      if (info.newUpdate) {
        settings.updateStatusSet('pending')
      }
    } catch (e) {
      this.error(new Error('Check update failed', { cause: e }))
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
      throw new Error('Cannot download update if we don\'t check the version update!')
    }
    this.log(`Start to download update: ${settings.updateInfo.name} operation=${settings.updateInfo.operation}`)
    await this.submit(this.app.updater.downloadUpdateTask(settings.updateInfo).setName('downloadUpdate'))
    settings.updateStatusSet('ready')
  }

  quit() {
    return this.app.quit()
  }

  exit(code?: number) {
    this.app.exit(code)
  }

  async reportItNow(options: { destination: string }): Promise<void> {
    const task = new ZipTask(options.destination)
    const logsDir = await this.app.registry.get(kLogRoot)
    const files = await readdir(logsDir)

    for (const file of files) {
      task.addFile(join(logsDir, file), join('logs', file))
    }

    const sessionId = await this.app.registry.get(kClientToken)

    task.addBuffer(Buffer.from(JSON.stringify({
      sessionId,
      platform: os.platform(),
      arch: os.arch(),
      version: os.version(),
      release: os.release(),
      type: os.type(),
    })), 'device.json')
    await task.startAndWait()

    this.showItemInDirectory(options.destination)
  }

  async migrate(options: MigrateOptions) {
    const getPath = await this.app.registry.get(kGameDataPath)
    const source = getPath()
    const destination = options.destination
    const destStat = await stat(destination).catch(() => undefined)
    if (destStat && destStat.isFile()) {
      throw new BaseServiceException({
        type: 'migrationDestinationIsFile',
        destination,
      })
    }
    if (destStat && destStat.isDirectory()) {
      const files = await readdir(destination)
      if (files.length !== 0) {
        throw new BaseServiceException({
          type: 'migrationDestinationIsNotEmptyDirectory',
          destination,
        })
      }
    }

    try {
      await this.app.dispose()
      this.log(`Try to use rename to migrate the files: ${source} -> ${destination}`)
      const files = await readdir(source)
      for (const file of files) {
        const from = join(source, file)
        const to = join(destination, file)
        try {
          await rename(from, to)
        } catch (e) {
          if (isSystemError(e)) {
            if (e.code === 'EXDEV') {
              // cannot move file across disk
              this.warn(`Cannot move file across disk ${from} -> ${to}. Use copy instead.`)
              await copyPassively(from, to)
              return
            }
            if (e.code === 'EPERM') {
              throw new BaseServiceException({
                type: 'migrationNoPermission',
                source,
                destination,
              })
            }
          }
          throw e
        }
      }
    } catch (e) {
      this.error(new AnyError('MigrateRootError', `Fail to migrate with rename ${source} -> ${destination} with unknown error`, { cause: e }))
      throw e
    }
    await this.app.migrateRoot(destination)

    this.app.relaunch()
    this.app.quit()
  }

  async validateDataDictionary(path: string): Promise<undefined | 'noperm' | 'bad' | 'nondictionary' | 'exists'> {
    return await validateDirectory(this.app.platform, path)
  }

  getMemoryStatus(): Promise<{ total: number; free: number }> {
    return Promise.resolve({
      total: totalmem(),
      free: freemem(),
    })
  }
}
