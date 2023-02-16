import { BaseService as IBaseService, BaseServiceException, BaseServiceKey, BaseState, MigrateOptions, SettingSchema } from '@xmcl/runtime-api'
import { readdir, rename, rm, stat } from 'fs/promises'
import os, { freemem, totalmem } from 'os'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { IS_DEV } from '../constant'
import { kTelemtrySession } from '../entities/telemetry'
import { isSystemError } from '../util/error'
import { copyPassively } from '../util/fs'
import { Inject } from '../util/objectRegistry'
import { createSafeFile } from '../util/persistance'
import { ZipTask } from '../util/zip'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

@ExposeServiceKey(BaseServiceKey)
export class BaseService extends StatefulService<BaseState> implements IBaseService {
  private settingFile = createSafeFile(this.getAppDataPath('setting.json'), SettingSchema, this, [this.getPath('setting.json')])

  constructor(
  @Inject(LauncherAppKey) app: LauncherApp,
  ) {
    super(app, () => {
      const state = new BaseState()
      state.version = app.version
      state.platform = app.platform
      state.build = app.build
      state.env = app.env
      state.root = app.gameDataPath
      return state
    }, async () => {
      const data = await this.settingFile.read()
      data.locale = data.locale || this.app.getPreferredLocale() || this.app.host.getLocale()
      this.state.config(data)
      this.checkUpdate()
    })
    app.gamePathReadySignal.promise.then(() => {
      this.state.root = app.gameDataPath
    })
    this.storeManager.subscribeAll([
      'localeSet',
      'allowPrereleaseSet',
      'autoInstallOnAppQuitSet',
      'autoDownloadSet',
      'apiSetsPreferenceSet',
      'apiSetsSet',
      'httpProxySet',
      'httpProxyEnabledSet',
      'themeSet',
      'maxSocketsSet',
      'discordPresenceSet',
      'globalInstanceSetting',
      'developerModeSet',
    ], () => {
      this.settingFile.write({
        locale: this.state.locale,
        autoInstallOnAppQuit: this.state.autoInstallOnAppQuit,
        autoDownload: this.state.autoDownload,
        allowPrerelease: this.state.allowPrerelease,
        apiSets: this.state.apiSets,
        apiSetsPreference: this.state.apiSetsPreference,
        httpProxy: this.state.httpProxy,
        httpProxyEnabled: this.state.httpProxyEnabled,
        theme: this.state.theme,
        maxSockets: this.state.maxSockets,
        globalMinMemory: this.state.globalMinMemory,
        globalMaxMemory: this.state.globalMaxMemory,
        globalAssignMemory: this.state.globalAssignMemory,
        globalVmOptions: this.state.globalVmOptions,
        globalMcOptions: this.state.globalMcOptions,
        globalFastLaunch: this.state.globalFastLaunch,
        globalHideLauncher: this.state.globalHideLauncher,
        globalShowLog: this.state.globalShowLog,
        discordPresence: this.state.discordPresence,
        developerMode: this.state.developerMode,
      })
    })
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
   * Try to open a url in default browser. It will popup a message dialog to let user know.
   * If user does not trust the url, it won't open the site.
   * @param url The pending url
   */
  openInBrowser(url: string) {
    return this.app.shell.openInBrowser(url)
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
    if (this.state.updateStatus === 'ready' && this.state.updateInfo) {
      await this.app.updater.installUpdateAndQuit(this.state.updateInfo)
    } else {
      this.warn('There is no update available!')
    }
  }

  /**
   * Check launcher update.
   */
  @Singleton()
  async checkUpdate() {
    if (IS_DEV) return
    try {
      this.log('Check update')
      const info = await this.submit(this.app.updater.checkUpdateTask())
      this.state.updateInfoSet(info)
      if (info.newUpdate) {
        this.state.updateStatusSet('pending')
      }
    } catch (e) {
      this.error('Check update failed')
      this.error(e)
      throw e
    }
  }

  /**
   * Download the update if there is available update
   */
  @Singleton()
  async downloadUpdate() {
    if (!this.state.updateInfo) {
      throw new Error('Cannot download update if we don\'t check the version update!')
    }
    this.log(`Start to download update: ${this.state.updateInfo.name} incremental=${this.state.updateInfo.incremental}`)
    await this.submit(this.app.updater.downloadUpdateTask(this.state.updateInfo).setName('downloadUpdate'))
    this.state.updateStatusSet('ready')
  }

  quit() {
    return this.app.quit()
  }

  exit(code?: number) {
    this.app.exit(code)
  }

  async reportItNow(options: { destination: string }): Promise<void> {
    const task = new ZipTask(options.destination)
    const logsDir = this.logManager.getLogRoot()
    const files = await readdir(logsDir)

    for (const file of files) {
      task.addFile(join(logsDir, file), join('logs', file))
    }

    task.addBuffer(Buffer.from(JSON.stringify({
      sessionId: this.app.registry.get(kTelemtrySession),
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
    const source = this.getPath()
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
      await rm(destination, { recursive: true, force: true })
    }

    await this.serviceManager.dispose()

    const renameOrCopy = async () => {
      try {
        this.log(`Try to use rename to migrate the files: ${source} -> ${destination}`)
        await rename(source, destination)
      } catch (e) {
        if (isSystemError(e)) {
          if (e.code === 'EXDEV') {
            // cannot move file across disk
            this.warn(`Cannot move file across disk ${source} -> ${destination}. Use copy instead.`)
            await copyPassively(source, destination)
            return
          }
        }
        throw e
      }
    }
    try {
      await renameOrCopy()
      await this.app.migrateRoot(destination)
    } catch (e) {
      this.error(`Fail to migrate with rename ${source} -> ${destination} with unknown error`)
      this.error(e)
      await this.app.migrateRoot(source).catch(() => { })
      throw e
    }

    this.app.relaunch()
    this.app.quit()
  }

  public shouldOverrideApiSet() {
    if (this.state.apiSetsPreference === 'mojang') {
      return false
    }
    if (this.state.apiSetsPreference === '') {
      return this.networkManager.isInGFW
    }
    return true
  }

  public getApiSets() {
    const apiSets = this.state.apiSets
    const api = apiSets.find(a => a.name === this.state.apiSetsPreference)
    const allSets = apiSets.filter(a => a.name !== this.state.apiSetsPreference)
    if (api) {
      allSets.unshift(api)
    }
    return allSets
  }

  getMemoryStatus(): Promise<{ total: number; free: number }> {
    return Promise.resolve({
      total: totalmem(),
      free: freemem(),
    })
  }
}
