import { getPlatform } from '@xmcl/core'
import { InstalledAppManifest, RuntimeVersions, UpdateInfo } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { EventEmitter } from 'events'
import { ensureDir, readFile, readJson, writeFile } from 'fs-extra'
import { extname, join } from 'path'
import { LAUNCHER_NAME } from '../constant'
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
import { isDirectory } from '../util/fs'
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
  on(channel: 'user-login', listener: (authService: string) => void): this
  on(channel: 'window-all-closed', listener: () => void): this
  on(channel: 'all-services-ready', listener: () => void): this
  on(channel: 'service-ready', listener: (service: AbstractService) => void): this
  on(channel: 'engine-ready', listener: () => void): this
  on(channel: 'minecraft-window-ready', listener: () => void): this
  on(channel: 'minecraft-start', listener: (launchOptions: { version: string } & RuntimeVersions) => void): this
  on(channel: 'minecraft-exit', listener: (exitStatus: { code: number; signal: string; crashReport: string; crashReportLocation: string; errorLog: string }) => void): this
  on(channel: 'minecraft-stdout', listener: (out: string) => void): this
  on(channel: 'minecraft-stderr', listener: (err: string) => void): this
  on(channel: 'microsoft-authorize-code', listener: (code: string) => void): this

  once(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  once(channel: 'user-login', listener: (authService: string) => void): this
  once(channel: 'window-all-closed', listener: () => void): this
  once(channel: 'all-services-ready', listener: () => void): this
  once(channel: 'service-ready', listener: (service: AbstractService) => void): this
  once(channel: 'engine-ready', listener: () => void): this
  once(channel: 'minecraft-window-ready', listener: () => void): this
  once(channel: 'minecraft-start', listener: (launchOptions: { version: string } & RuntimeVersions) => void): this
  once(channel: 'minecraft-exit', listener: (exitStatus: { code: number; signal: string; crashReport: string; crashReportLocation: string; errorLog: string }) => void): this
  once(channel: 'minecraft-stdout', listener: (out: string) => void): this
  once(channel: 'minecraft-stderr', listener: (err: string) => void): this
  once(channel: 'microsoft-authorize-code', listener: (error?: Error, code?: string) => void): this

  emit(channel: 'app-booted', manifest: InstalledAppManifest): this
  emit(channel: 'user-login', authService: string): this
  emit(channel: 'microsoft-authorize-code', error?: Error, code?: string): this
  emit(channel: 'window-all-closed'): boolean
  emit(channel: 'engine-ready'): boolean
  emit(channel: 'all-services-ready'): boolean
  emit(channel: 'service-ready', service: AbstractService): boolean
  emit(channel: 'minecraft-window-ready', ...args: any[]): boolean
  emit(channel: 'minecraft-start', launchOptions: { version: string } & RuntimeVersions): boolean
  emit(channel: 'minecraft-exit', exitStatus: { code: number; signal: string; crashReport: string; crashReportLocation: string; errorLog: string }): boolean
  emit(channel: 'minecraft-stdout', out: string): boolean
  emit(channel: 'minecraft-stderr', err: string): boolean
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

  /**
     * ref for if the game is launching and the launcher is paused
     */
  protected parking = false

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

  abstract readonly version: string

  readonly build: number = Number.parseInt(process.env.BUILD_NUMBER ?? '0', 10)

  get isParking(): boolean { return this.parking }

  protected managers = [this.logManager, this.networkManager, this.taskManager, this.serviceStateManager, this.serviceManager, this.telemetryManager, this.credentialManager, this.workerManager, this.semaphoreManager, this.launcherAppManager]

  readonly controller: LauncherAppController

  constructor() {
    super()
    const appData = this.getPath('appData')
    this.appDataPath = join(appData, LAUNCHER_NAME)
    this.gameDataPath = ''
    this.minecraftDataPath = join(appData, this.platform.name === 'osx' ? 'minecraft' : '.minecraft')
    this.temporaryPath = ''
    this.controller = this.createController()
  }

  abstract getDefaultAppManifest(): InstalledAppManifest

  abstract createController(): LauncherAppController

  abstract getLocale(): string

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

  /**
   * Handle the url activate the app
   * @param url The url input
   */
  abstract handleUrl(url: string): void

  /**
   * Quit the app gently.
   */
  quit() {
    Promise.all(this.managers.map(m => m.beforeQuit()))
      .then(() => this.quitApp())
  }

  /**
   * Quit the app gently.
   */
  protected abstract quitApp(): void

  /**
   * Force exit the app with exit code
   */
  abstract exit(code?: number): void

  /**
   * Get the system provided path
   */
  abstract getPath(key: 'home' | 'appData' | 'userData' | 'cache' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'recent' | 'logs' | 'crashDumps'): string

  /**
   * Wait the engine ready
   */
  abstract waitEngineReady(): Promise<void>

  /**
   * Get module exposed to controller
   * @param key The module name
   */
  abstract getModule(key: string): any

  /**
   * Check update for the x-minecraft-launcher-core
   */
  abstract checkUpdateTask(): Task<UpdateInfo>

  /**
   * Download the update to the disk. You should first call `checkUpdate`
   */
  abstract downloadUpdateTask(updateInfo: UpdateInfo): Task<void>

  /**
     * Install update and quit the app.
     */
  abstract installUpdateAndQuit(updateInfo: UpdateInfo): Promise<void>

  abstract relaunch(): void

  log = (message: any, ...options: any[]) => { this.logManager.log(`[App] ${message}`, ...options) }

  warn = (message: any, ...options: any[]) => { this.logManager.warn(`[App] ${message}`, ...options) }

  error = (message: any, ...options: any[]) => { this.logManager.error(`[App] ${message}`, ...options) }

  /**
   * Start an app from file path
   * @param path The path of json
   */
  // protected async startFromFilePath(path: string) {
  //   const ext = extname(path)
  //   if (ext === '.xmclm') {
  //     const manifest: AppManifest = await readJson(path)
  //     await this.loadManifest(manifest)
  //   } else if (ext === '.xmclapp') {
  //     await this.bootApp(path)
  //   } else if (await isDirectory(path)) {
  //     await this.bootApp(path)
  //   }
  // }

  // phase code

  readonly serviceReadyPromise = new Promise<void>((resolve) => {
    this.on('all-services-ready', resolve)
  })

  // setup code

  async start(): Promise<void> {
    await this.setup()
    await this.waitEngineReady()
    await this.onEngineReady()
    await this.serviceReadyPromise
    await this.onStoreReady()
  }

  /**
   * Determine the root of the project. By default, it's %APPDATA%/xmcl
   */
  protected async setup() {
    console.log(`Boot from ${this.appDataPath}`)
    try {
      await ensureDir(this.appDataPath)
      const self = this as any
      self.gameDataPath = await readFile(join(this.appDataPath, 'root')).then((b) => b.toString().trim())
    } catch (e) {
      if (isSystemError(e) && e.code === 'ENOENT') {
        // first launch
        await this.waitEngineReady();
        (this.gameDataPath as any) = await this.controller.processFirstLaunch()
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
    this.log(process.cwd())
    this.log(process.argv)
  }

  async migrateRoot(newRoot: string) {
    (this.gameDataPath as any) = newRoot
    await writeFile(join(this.appDataPath, 'root'), newRoot)
  }

  protected async onEngineReady() {
    this.emit('engine-ready')
    this
      .on('window-all-closed', () => {
        if (this.parking) return
        if (process.platform !== 'darwin') { this.quitApp() }
      })
      .on('minecraft-start', () => { this.parking = true })
      .on('minecraft-exit', () => { this.parking = false })

    // start the app
    let app: InstalledAppManifest
    try {
      const { default: url } = await readJson(join(this.launcherAppManager.root, 'apps.json'))
      app = await this.launcherAppManager.getInstalledApp(url)
    } catch (e) {
      app = this.getDefaultAppManifest()
    }
    await this.controller.bootApp(app)

    await Promise.all(this.managers.map(m => m.engineReady()))
  }

  protected async onStoreReady() {
    this.parking = true
    await Promise.all(this.managers.map(m => m.storeReady()))
    await this.controller.dataReady()
    this.log('App booted')
    this.parking = false
  }
}

export default LauncherApp
