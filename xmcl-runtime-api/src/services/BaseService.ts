import { SettingSchema } from '../entities/setting.schema'
import { ReleaseInfo } from '../entities/update'
import { ServiceKey, StatefulService } from './Service'

export interface MigrateOptions {
  destination: string
}

export class BaseState implements SettingSchema {
  locale = ''

  theme = 'dark' as 'dark' | 'light' | 'system'
  /**
   * All supported languages of the launcher
   */
  locales: string[] = []
  updateInfo: ReleaseInfo | null = null
  updateStatus: 'ready' | 'none' | 'pending' = 'none'
  allowPrerelease = false
  autoInstallOnAppQuit = false
  autoDownload = false
  apiSetsPreference: 'mojang' | 'mcbbs' | 'bmcl' = 'mcbbs'
  apiSets = [{ name: 'mcbbs', url: 'https://download.mcbbs.net' }, { name: 'bmcl', url: 'https://bmclapi2.bangbang93.com' }]

  /**
   * The container of the launcher. Will be raw if the launcher is just installed on system. Will be appx if it's appx.
   */
  env: 'raw' | 'appx' | 'appimage' = 'raw'
  /**
   * The version of the launcher
   */
  version = ''
  /**
   * The current build number
   */
  build = 0
  /**
    * launcher root data folder path
    */
  root = ''
  /**
   * Is current environment connecting to internet?
   */
  online = false
  /**
   * The current operating system platform
   */
  platform: 'linux' | 'win32' | 'darwin' = 'win32'

  httpProxy = ''

  httpProxyEnabled = false

  config(config: SettingSchema) {
    this.locale = config.locale
    this.autoDownload = config.autoDownload || false
    this.autoInstallOnAppQuit = config.autoDownload || false
    this.allowPrerelease = config.allowPrerelease || false
    this.apiSetsPreference = typeof config.apiSetsPreference === 'string' ? config.apiSetsPreference : 'mcbbs'
    this.httpProxy = config.httpProxy
    this.httpProxyEnabled = config.httpProxyEnabled
    this.theme = config.theme
  }

  themeSet(theme: 'dark' | 'light' | 'system') {
    this.theme = theme
  }

  localeSet(language: string) {
    this.locale = language
  }

  localesSet(languages: string[]) {
    this.locales = languages
  }

  httpProxySet(proxy: string) {
    this.httpProxy = proxy
  }

  httpProxyEnabledSet(enabled: boolean) {
    this.httpProxyEnabled = enabled
  }

  allowPrereleaseSet(allowPrerelease: boolean) {
    if (typeof allowPrerelease === 'boolean') { this.allowPrerelease = allowPrerelease }
  }

  autoInstallOnAppQuitSet(autoInstallOnAppQuit: boolean) {
    if (typeof autoInstallOnAppQuit === 'boolean') this.autoInstallOnAppQuit = autoInstallOnAppQuit
  }

  updateStatusSet(updateStatus: 'ready' | 'none' | 'pending') {
    this.updateStatus = updateStatus
  }

  autoDownloadSet(autoDownload: boolean) {
    if (typeof autoDownload === 'boolean') this.autoDownload = autoDownload
  }

  updateInfoSet(updateInfo: ReleaseInfo) {
    if (typeof updateInfo === 'object') this.updateInfo = updateInfo
  }

  apiSetsPreferenceSet(apiSetsPreference: 'mojang' | 'bmcl' | 'mcbbs') {
    this.apiSetsPreference = apiSetsPreference
  }

  apiSetsSet(sets: { name: string; url: string }[]) {
    this.apiSets = sets
  }

  versionSet([version, build]: [string, number]) {
    this.version = version; this.build = build ?? 0
  }

  rootSet(root: string) {
    this.root = root
  }

  onlineSet(online: boolean) {
    this.online = online
  }

  platformSet(platform: 'linux' | 'win32' | 'darwin') {
    this.platform = platform
  }
}

export interface BaseService extends StatefulService<BaseState> {
  /**
   * let the launcher to handle a url open. The url can be xmcl:// protocol
   */
  handleUrl(url: string): Promise<void>
  /**
   * Try to open a url in default browser. It will popup a message dialog to let user know.
   * If user does not trust the url, it won't open the site.
   * @param url The pending url
   */
  openInBrowser: (url: string) => Promise<boolean>
  /**
   * A electron provided function to show item in directory
   * @param path The path to the file item
   */
  showItemInDirectory: (path: string) => void
  /**
   * A safe method that only open directory. If the `path` is a file, it won't execute it.
   * @param path The directory path.
   */
  openDirectory: (path: string) => Promise<boolean>
  /**
   * Quit and install the update once the update is ready
   */
  quitAndInstall(): Promise<void>
  /**
   * Check launcher update.
   */
  checkUpdate(): Promise<void>
  /**
   * Download the update if there is available update
   */
  downloadUpdate(): Promise<void>
  /**
   * Quit the launcher
   */
  quit(): void
  /**
   * Exit the launcher with code
   * @param code The code number
   */
  exit(code?: number | undefined): void

  migrate(options: MigrateOptions): Promise<void>
  postMigrate(): Promise<void>
}

export const BaseServiceKey: ServiceKey<BaseService> = 'BaseService'
