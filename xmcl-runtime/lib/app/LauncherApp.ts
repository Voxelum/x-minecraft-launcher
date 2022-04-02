import { getPlatform } from '@xmcl/core'
import { InstalledAppManifest, ReleaseInfo } from '@xmcl/runtime-api'
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
import AbstractService from '../services/Service'
import { isSystemError } from '../util/error'
import { Host } from './Host'
import { LauncherAppController } from './LauncherAppController'
import { LauncherAppManager } from './LauncherAppManager'

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
  on(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  on(channel: 'window-all-closed', listener: () => void): this
  on(channel: 'all-services-ready', listener: () => void): this
  on(channel: 'service-ready', listener: (service: AbstractService) => void): this
  on(channel: 'engine-ready', listener: () => void): this
  on(channel: 'microsoft-authorize-code', listener: (code: string) => void): this

  once(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  once(channel: 'window-all-closed', listener: () => void): this
  once(channel: 'all-services-ready', listener: () => void): this
  once(channel: 'service-ready', listener: (service: AbstractService) => void): this
  once(channel: 'engine-ready', listener: () => void): this
  once(channel: 'microsoft-authorize-code', listener: (error?: Error, code?: string) => void): this

  emit(channel: 'app-booted', manifest: InstalledAppManifest): this
  emit(channel: 'microsoft-authorize-code', error?: Error, code?: string): this
  emit(channel: 'window-all-closed'): boolean
  emit(channel: 'engine-ready'): boolean
  emit(channel: 'all-services-ready'): boolean
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

  readonly networkManager = new NetworkManager(this)

  readonly serviceManager = new ServiceManager(this)

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

  get version() { return this.host.getVersion() }

  protected managers = [this.logManager, this.networkManager, this.taskManager, this.serviceStateManager, this.serviceManager, this.telemetryManager, this.credentialManager, this.workerManager, this.semaphoreManager, this.launcherAppManager]

  abstract readonly host: Host

  abstract readonly controller: LauncherAppController

  abstract readonly defaultAppManifest: InstalledAppManifest

  constructor() {
    super()
    this.appDataPath = ''
    this.gameDataPath = ''
    this.minecraftDataPath = ''
    this.temporaryPath = ''
  }

  private initialInstance = ''
  private preferredLocale = ''

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

  getLocale(): string { return this.host.getLocale() }

  /**
   * Handle the url activate the app
   * @param url The url input
   */
  handleUrl(url: string) {
    const parsed = new URL(url, 'xmcl://')
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
    }
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

    const appData = this.host.getPath('appData')

    const _this = this as any
    _this.appDataPath = join(appData, LAUNCHER_NAME)
    _this.minecraftDataPath = join(appData, this.platform.name === 'osx' ? 'minecraft' : '.minecraft')

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
      }
    }
    this.log('Didn\'t find the start up url, try to load from config file.')
    const { default: url } = await readJson(join(this.launcherAppManager.root, 'apps.json'))

    this.log(`Start up url: ${url}`)
    return url
  }

  protected async onEngineReady() {
    this.log(`cwd: ${process.cwd()}`)
    this.emit('engine-ready')
    this
      .on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
          this.quit()
        }
      })

    // start the app
    let app: InstalledAppManifest
    try {
      const url = await this.getStartupUrl()
      app = await this.launcherAppManager.getInstalledApp(url)
    } catch (e) {
      app = this.defaultAppManifest
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
