import { getPlatform } from '@xmcl/core'
import { InstalledAppManifest, PeerService, ReleaseInfo } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { EventEmitter } from 'events'
import { ensureDir, readFile, readJson, writeFile } from 'fs-extra'
import { join } from 'path'
import { URL } from 'url'
import { IS_DEV, LAUNCHER_NAME } from '../constant'
import { Client } from '../engineBridge'
import CredentialManager from '../managers/CredentialManager'
import LogManager from '../managers/LogManager'
import NetworkManager from '../managers/NetworkManager'
import SemaphoreManager from '../managers/SemaphoreManager'
import ServiceManager from '../managers/ServiceManager'
import ServiceStateManager from '../managers/ServiceStateManager'
import TaskManager from '../managers/TaskManager'
import TelemetryManager from '../managers/TelemetryManager'
import WorkerManager from '../managers/WorkerManager'
import { AbstractService, ServiceConstructor } from '../services/Service'
import { isSystemError } from '../util/error'
import { Host } from './Host'
import { LauncherAppController } from './LauncherAppController'
import { LauncherAppManager } from './LauncherAppManager'
import { UserService } from '../services/UserService'
import { Manager } from '../managers'

export interface Platform {
  /**
   * The system name of the platform. This name is majorly used for download.
   */
  name: 'osx' | 'linux' | 'windows' | 'unknown'
  /**
   * The version of the os. It should be the value of `os.release()`.
   */
  version: string
  /**
   * The direct output of `os.arch()`. Should look like x86 or x64.
   */
  arch: 'x86' | 'x64' | string
}

export interface LauncherApp {
  on(channel: 'peer-join', listener: (info: { description: string; type: 'offer' | 'answer' }) => void): this
  on(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  on(channel: 'window-all-closed', listener: () => void): this
  on(channel: 'service-ready', listener: (service: AbstractService) => void): this
  on(channel: 'engine-ready', listener: () => void): this
  on(channel: 'microsoft-authorize-code', listener: (code: string) => void): this

  once(channel: 'peer-join', listener: (info: { description: string; type: 'offer' | 'answer' }) => void): this
  once(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  once(channel: 'window-all-closed', listener: () => void): this
  once(channel: 'service-ready', listener: (service: AbstractService) => void): this
  once(channel: 'engine-ready', listener: () => void): this
  once(channel: 'microsoft-authorize-code', listener: (error?: Error, code?: string) => void): this

  emit(channel: 'peer-join', info: { description: string; type: 'offer' | 'answer' }): this
  emit(channel: 'app-booted', manifest: InstalledAppManifest): this
  emit(channel: 'microsoft-authorize-code', error?: Error, code?: string): this
  emit(channel: 'window-all-closed'): boolean
  emit(channel: 'engine-ready'): boolean
  emit(channel: 'service-ready', service: AbstractService): boolean
}

export abstract class LauncherApp extends EventEmitter {
  /**
   * Launcher %APPDATA%/xmcl path
   */
  readonly appDataPath: string

  /**
   * Store Minecraft data
   */
  readonly gameDataPath: string

  /**
   * The .minecraft folder in Windows or minecraft folder in linux/mac
   */
  readonly minecraftDataPath: string

  /**
   * Path to temporary folder
   */
  readonly temporaryPath: string

  // properties

  readonly networkManager: NetworkManager

  readonly serviceManager = new ServiceManager(this, this.getPreloadServices())

  readonly serviceStateManager = new ServiceStateManager(this)

  readonly taskManager = new TaskManager(this)

  readonly logManager = new LogManager(this)

  readonly telemetryManager = new TelemetryManager(this)

  readonly credentialManager = new CredentialManager(this)

  readonly workerManager = new WorkerManager(this)

  readonly semaphoreManager = new SemaphoreManager(this)

  readonly launcherAppManager = new LauncherAppManager(this)

  readonly platform: Platform = getPlatform()

  readonly build: number = Number.parseInt(process.env.BUILD_NUMBER ?? '0', 10)

  readonly env = process.env.BUILD_TARGET === 'appx' ? 'appx' : process.env.BUILD_TARGET === 'appimage' ? 'appimage' : 'raw'

  get version() { return this.host.getVersion() }

  protected managers: Manager[]

  abstract readonly host: Host

  abstract readonly controller: LauncherAppController

  abstract readonly builtinAppManifest: InstalledAppManifest

  abstract getAppInstallerStartUpUrl(): string

  abstract getPreloadServices(): ServiceConstructor[]

  constructor() {
    super()
    this.gameDataPath = ''
    this.temporaryPath = ''

    const appData = this.getHost().getPath('appData')

    this.appDataPath = join(appData, LAUNCHER_NAME)
    this.minecraftDataPath = join(appData, this.platform.name === 'osx' ? 'minecraft' : '.minecraft')

    this.networkManager = new NetworkManager(this)
    this.managers = [this.logManager, this.networkManager, this.taskManager, this.serviceStateManager, this.serviceManager, this.telemetryManager, this.credentialManager, this.workerManager, this.semaphoreManager, this.launcherAppManager]
  }

  private initialInstance = ''
  private preferredLocale = ''

  abstract getHost(): Host

  getInitialInstance() {
    return this.initialInstance
  }

  getPreferredLocale() {
    return this.preferredLocale
  }

  /**
   * Broadcast a event with payload to client.
   *
   * @param channel The event channel to client
   * @param payload The event payload to client
   */
  abstract broadcast(channel: string, ...payload: any[]): void

  /**
   * Handle a invoke operation from client
   *
   * @param channel The invoke channel to listen
   * @param handler The listener callback will be called during this event received
   */
  abstract handle(channel: string, handler: (event: { sender: Client }, ...args: any[]) => any): void

  /**
   * A safe method that only open directory. If the `path` is a file, it won't execute it.
   * @param file The directory path
   */
  abstract openDirectory(path: string): Promise<boolean>

  /**
   * Try to open a url in default browser. It will popup a message dialog to let user know.
   * If user does not trust the url, it won't open the site.
   * @param url The pending url
   */
  abstract openInBrowser(url: string): Promise<boolean>

  /**
   * Show the item in folder
   * @param path The file path to show.
   */
  abstract showItemInFolder(path: string): void

  abstract createShortcut(path: string, link: {
    /**
     * The Application User Model ID. Default is empty.
     */
    appUserModelId?: string
    /**
     * The arguments to be applied to `target` when launching from this shortcut.
     * Default is empty.
     */
    args?: string
    /**
     * The working directory. Default is empty.
     */
    cwd?: string
    /**
     * The description of the shortcut. Default is empty.
     */
    description?: string
    /**
     * The path to the icon, can be a DLL or EXE. `icon` and `iconIndex` have to be set
     * together. Default is empty, which uses the target's icon.
     */
    icon?: string
    /**
     * The resource ID of icon when `icon` is a DLL or EXE. Default is 0.
     */
    iconIndex?: number
    /**
     * The target to launch from this shortcut.
     */
    target: string
    /**
     * The Application Toast Activator CLSID. Needed for participating in Action
     * Center.
     */
    toastActivatorClsid?: string
  }): boolean

  getLocale(): string { return this.host.getLocale() }

  /**
   * Handle the url activate the app
   * @param url The url input
   */
  handleUrl(url: string) {
    if (url.startsWith('authlib-injector:yggdrasil-server:')) {
      const serverUrl = decodeURIComponent(url.substring('authlib-injector:yggdrasil-server:'.length))
      const parsed = new URL(serverUrl)
      const domain = parsed.host
      const userService = this.serviceManager.getOrCreateService(UserService)
      userService.state.authServiceSet({
        name: domain,
        api: {
          hostName: serverUrl,
          authenticate: '/authserver/authenticate',
          refresh: '/authserver/refresh',
          validate: '/authserver/validate',
          invalidate: '/authserver/invalidate',
          signout: '/authserver/signout',
        },
      })
      userService.state.profileServiceSet({
        name: domain,
        api: {
          profile: `${serverUrl}/sessionserver/session/minecraft/profile/\${uuid}`,
          profileByName: `${serverUrl}/users/profiles/minecraft/\${name}`,
          texture: `${serverUrl}/user/profile/\${uuid}/\${type}`,
        },
      })
      userService.emit('auth-profile-added', domain)
      this.log(`Import the url ${url} as authlib-injector profile ${domain}`)
      return true
    }
    const parsed = new URL(url, 'xmcl://launcher')
    this.log(`Handle url ${url}`)
    if (parsed.host === 'launcher' && parsed.pathname === '/auth') {
      let error: Error | undefined
      if (parsed.searchParams.get('error')) {
        const err = parsed.searchParams.get('error')!
        const errDescription = parsed.searchParams.get('error')!
        error = new Error(unescape(errDescription));
        (error as any).error = err
      }
      const code = parsed.searchParams.get('code') as string
      this.emit('microsoft-authorize-code', error, code)
      return true
    } else if (parsed.host === 'launcher' && parsed.pathname === '/app') {
      const params = parsed.searchParams
      const appUrl = params.get('url')
      if (appUrl) {
        this.log(`Boot app from app url ${appUrl}!`)
        this.launcherAppManager.bootAppByUrl(appUrl)
        return true
      } else {
        return false
      }
    } else if (parsed.host === 'launcher' && parsed.pathname === '/peer') {
      const params = parsed.searchParams
      const description = params.get('description')
      const type = params.get('type')
      if (!description || !type) {
        this.warn(`Ignore illegal peer join for type=${type} description=${description}`)
        return false
      } else {
        this.emit('peer-join', { description, type: type as any })
        return true
      }
    }
    this.warn(`Unknown url ${url}`)
    return false
  }

  /**
   * Quit the app gently.
   */
  quit() {
    Promise.all(this.managers.map(m => m.beforeQuit()))
      .then(() => this.host.quit())
  }

  /**
   * Force exit the app with exit code
   */
  exit(code?: number): void {
    this.host.exit(code)
  }

  /**
   * Get the system provided path
   */
  getPath(key: 'home' | 'appData' | 'userData' | 'cache' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'recent' | 'logs' | 'crashDumps'): string {
    return this.host.getPath(key)
  }

  waitEngineReady(): Promise<void> {
    return this.host.whenReady()
  }

  /**
   * Check update for the x-minecraft-launcher-core
   */
  abstract checkUpdateTask(): Task<ReleaseInfo>

  /**
   * Download the update to the disk. You should first call `checkUpdate`
   */
  abstract downloadUpdateTask(updateInfo: ReleaseInfo): Task<void>

  /**
   * Install update and quit the app.
   */
  abstract installUpdateAndQuit(updateInfo: ReleaseInfo): Promise<void>

  relaunch(): void { this.host.relaunch() }

  log = (message: any, ...options: any[]) => { this.logManager.log(`[App] ${message}`, ...options) }

  warn = (message: any, ...options: any[]) => { this.logManager.warn(`[App] ${message}`, ...options) }

  error = (message: any, ...options: any[]) => { this.logManager.error(`[App] ${message}`, ...options) }

  // setup code

  async start(): Promise<void> {
    await this.setup()
    await this.waitEngineReady()
    await this.onEngineReady()
    await this.onServiceReady()
  }

  /**
   * Determine the root of the project. By default, it's %APPDATA%/xmcl
   */
  protected async setup() {
    process.on('SIGINT', () => {
      this.host.quit()
    })

    // singleton lock
    if (!this.host.requestSingleInstanceLock()) {
      this.host.quit()
      return
    }

    console.log(`Boot from ${this.appDataPath}`)
    try {
      await ensureDir(this.appDataPath)
      const self = this as any
      self.gameDataPath = await readFile(join(this.appDataPath, 'root')).then((b) => b.toString().trim())
    } catch (e) {
      if (isSystemError(e) && e.code === 'ENOENT') {
        // first launch
        await this.waitEngineReady()
        const { path, instancePath, locale } = await this.controller.processFirstLaunch()
        this.initialInstance = instancePath
        this.preferredLocale = locale;
        (this.gameDataPath as any) = path
        await writeFile(join(this.appDataPath, 'root'), this.gameDataPath)
      } else {
        (this.gameDataPath as any) = this.appDataPath
      }
    }

    try {
      await ensureDir(this.gameDataPath)
    } catch {
      (this.gameDataPath as any) = this.appDataPath
      await Promise.all([ensureDir(this.gameDataPath)])
    }
    (this.temporaryPath as any) = join(this.gameDataPath, 'temp')
    await ensureDir(this.temporaryPath)
    await Promise.all(this.managers.map(m => m.setup()))

    // register xmcl protocol
    if (!this.host.isDefaultProtocolClient('xmcl')) {
      const result = this.host.setAsDefaultProtocolClient('xmcl')
      if (result) {
        this.log('Successfully register the xmcl protocol')
      } else {
        this.log('Fail to register the xmcl protocol')
      }
    }
  }

  async migrateRoot(newRoot: string) {
    (this.gameDataPath as any) = newRoot
    await writeFile(join(this.appDataPath, 'root'), newRoot)
  }

  protected async getStartupUrl() {
    if (!IS_DEV && process.platform === 'win32') {
      this.log(`Try to check the start up url: ${process.argv.join(' ')}`)
      if (process.argv.length > 1) {
        const urlOption = process.argv.find(a => a.startsWith('--url='))
        if (urlOption) {
          const url = urlOption.substring('--url='.length)
          if (url) {
            return url
          }
        }
        this.log('Didn\'t find --url options')
        const protocolOption = process.argv.find(a => a.startsWith('xmcl://'))
        if (protocolOption) {
          const u = new URL(protocolOption)
          if (u.host === 'launcher' && u.pathname === '/app' && u.searchParams.has('url')) {
            return u.searchParams.get('url')
          }
        }
        this.log('Didn\'t find xmcl:// protocol')
      }
    }
    this.log('Didn\'t find the start up url, try to load from config file.')
    const { default: url } = JSON.parse(await readFile(join(this.launcherAppManager.root, 'apps.json'), 'utf-8'))

    return url
  }

  protected async onEngineReady() {
    this.log(`cwd: ${process.cwd()}`)
    this.emit('engine-ready')

    // start the app
    let app: InstalledAppManifest
    try {
      const url = await this.getStartupUrl()
      this.log(`Try to use start up url ${url}`)
      const existedApp = await this.launcherAppManager.tryGetInstalledApp(url)
      if (existedApp) {
        app = existedApp
      } else {
        app = await this.launcherAppManager.installApp(url)
      }
    } catch (e) {
      this.warn('Fail to use start up url:')
      this.warn(e)
      try {
        const startUp = this.getAppInstallerStartUpUrl()
        if (startUp) {
          this.log(`Try to use appinstaller startup url: "${startUp}"`)
          app = await this.launcherAppManager.installApp(startUp)
        } else {
          app = this.builtinAppManifest
        }
      } catch (e) {
        app = this.builtinAppManifest
      }
    }
    await this.controller.bootApp(app)

    await Promise.all(this.managers.map(m => m.engineReady()))
  }

  protected async onServiceReady() {
    this.log(`Current launcher core version is ${this.version}.`)
    await Promise.all(this.managers.map(m => m.storeReady()))
    await this.controller.dataReady()
    this.log('App booted')
  }
}

export default LauncherApp
