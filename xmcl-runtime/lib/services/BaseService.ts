import { BaseService as IBaseService, BaseServiceException, BaseServiceKey, BaseState, MigrateOptions, SettingSchema } from '@xmcl/runtime-api'
import { copy, readdir, remove, rename, stat } from 'fs-extra'
import os, { freemem, totalmem } from 'os'
import LauncherApp from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { isSystemError } from '../util/error'
import { createSafeFile } from '../util/persistance'
import { ZipTask } from '../util/zip'
import { Singleton, StatefulService } from './Service'

export class BaseService extends StatefulService<BaseState> implements IBaseService {
  private settingFile = createSafeFile(this.getAppDataPath('setting.json'), SettingSchema, this, [this.getPath('setting.json')])

  constructor(app: LauncherApp) {
    super(app, BaseServiceKey, () => {
      const state = new BaseState()
      state.version = app.version
      state.build = app.build
      state.env = app.env
      state.root = app.gameDataPath
      return state
    }, async () => {
      const data = await this.settingFile.read()
      this.state.config({
        locale: data.locale || this.app.getPreferredLocale() || this.app.getLocale(),
        autoInstallOnAppQuit: data.autoInstallOnAppQuit,
        autoDownload: data.autoDownload,
        allowPrerelease: data.allowPrerelease,
        apiSets: data.apiSets,
        apiSetsPreference: data.apiSetsPreference,
        httpProxy: data.httpProxy,
        httpProxyEnabled: data.httpProxyEnabled,
        theme: data.theme,
        maxSockets: data.maxSockets,
        maxTotalSockets: data.maxTotalSockets,
      })
      this.checkUpdate()
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
        maxTotalSockets: this.state.maxTotalSockets,
      })
    })
  }

  async handleUrl(url: string) {
    this.emit('url-drop', url)
    return this.app.handleUrl(url)
  }

  /**
   * Try to open a url in default browser. It will popup a message dialog to let user know.
   * If user does not trust the url, it won't open the site.
   * @param url The pending url
   */
  openInBrowser = this.app.openInBrowser.bind(this.app)

  /**
   * A electron provided function to show item in directory
   * @param path The path to the file item
   */
  showItemInDirectory = this.app.showItemInFolder

  /**
   * A safe method that only open directory. If the `path` is a file, it won't execute it.
   * @param path The directory path.
   */
  openDirectory = this.app.openDirectory

  /**
   * Quit and install the update once the update is ready
   */
  @Singleton()
  async quitAndInstall() {
    if (this.state.updateStatus === 'ready' && this.state.updateInfo) {
      await this.app.installUpdateAndQuit(this.state.updateInfo)
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
      const info = await this.submit(this.app.checkUpdateTask())
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
    await this.submit(this.app.downloadUpdateTask(this.state.updateInfo).setName('downloadUpdate'))
    this.state.updateStatusSet('ready')
  }

  quit = this.app.quit.bind(this.app)

  exit = this.app.exit

  async reportItNow(options: { destination: string }): Promise<void> {
    const task = new ZipTask(options.destination)
    task.includeAs(this.logManager.getLogRoot(), 'logs')

    task.addBuffer(Buffer.from(JSON.stringify({
      sessionId: this.telemetryManager.getSessionId(),
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
      await remove(destination)
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
            await copy(source, destination)
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
