import { getPlatform } from '@xmcl/core'
import { InstalledAppManifest, Platform } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { ensureDir, readFile, writeFile } from 'fs-extra'
import { createServer, Server } from 'http'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { setTimeout } from 'timers/promises'
import { URL } from 'url'
import { IS_DEV, LAUNCHER_NAME } from '../constant'
import { Manager } from '../managers'
import LogManager from '../managers/LogManager'
import NetworkManager from '../managers/NetworkManager'
import SemaphoreManager from '../managers/SemaphoreManager'
import ServiceManager from '../managers/ServiceManager'
import ServiceStateManager from '../managers/ServiceStateManager'
import TaskManager from '../managers/TaskManager'
import { plugins } from '../plugins'
import { AbstractService, ServiceConstructor } from '../services/Service'
import { isSystemError } from '../util/error'
import { ObjectFactory } from '../util/objectRegistry'
import { createPromiseSignal } from '../util/promiseSignal'
import { listen } from '../util/server'
import { Host } from './Host'
import { LauncherAppController } from './LauncherAppController'
import { LauncherAppManager } from './LauncherAppManager'
import { LauncherAppUpdater } from './LauncherAppUpdater'
import { LauncherProtocolHandler } from './LauncherProtocolHandler'
import { Shell } from './Shell'
import { LauncherAppKey } from './utils'

export interface LauncherAppPlugin {
  (app: LauncherApp): void
}

export interface LauncherApp {
  on(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  on(channel: 'window-all-closed', listener: () => void): this
  on(channel: 'engine-ready', listener: () => void): this

  once(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  once(channel: 'window-all-closed', listener: () => void): this
  once(channel: 'engine-ready', listener: () => void): this

  emit(channel: 'app-booted', manifest: InstalledAppManifest): this
  emit(channel: 'window-all-closed'): boolean
  emit(channel: 'engine-ready'): boolean
}

export class LauncherApp extends EventEmitter {
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

  readonly networkManager: NetworkManager

  readonly logManager: LogManager
  readonly serviceManager: ServiceManager
  readonly serviceStateManager: ServiceStateManager
  readonly taskManager: TaskManager
  readonly semaphoreManager: SemaphoreManager
  readonly launcherAppManager: LauncherAppManager

  readonly platform: Platform = getPlatform()

  readonly build: number = Number.parseInt(process.env.BUILD_NUMBER ?? '0', 10)

  readonly env = process.env.BUILD_TARGET === 'appx' ? 'appx' : process.env.BUILD_TARGET === 'appimage' ? 'appimage' : 'raw'

  get version() { return this.host.getVersion() }

  protected managers: Manager[]

  readonly protocol = new LauncherProtocolHandler()

  readonly server: Server = createServer((req, res) => {
    this.protocol.handle({
      method: req.method,
      url: new URL(req.url ?? '/', 'xmcl://launcher'),
      headers: req.headers,
      body: req,
    }).then((resp) => {
      res.statusCode = resp.status
      for (const [k, v] of Object.entries(resp.headers)) {
        res.setHeader(k, v)
      }
      if (resp.body instanceof Readable) {
        pipeline(resp.body, res)
      } else {
        res.end(resp.body)
      }
    }, (e) => {
      res.statusCode = 500
      res.end()
    })
  })

  readonly gamePathReadySignal = createPromiseSignal()

  readonly gamePathMissingSignal = createPromiseSignal<boolean>()

  /**
   * The controller is response to keep the communication between main process and renderer process
   */
  readonly controller: LauncherAppController
  /**
   * The updater of the launcher
   */
  readonly updater: LauncherAppUpdater

  constructor(
    readonly host: Host,
    readonly shell: Shell,
    getController: (app: LauncherApp) => LauncherAppController,
    getUpdater: (app: LauncherApp) => LauncherAppUpdater,
    readonly builtinAppManifest: InstalledAppManifest,
    readonly preloads: ServiceConstructor[],
  ) {
    super()
    this.gameDataPath = ''
    this.temporaryPath = ''
    const appData = host.getPath('appData')

    this.appDataPath = join(appData, LAUNCHER_NAME)
    this.minecraftDataPath = join(appData, this.platform.name === 'osx' ? 'minecraft' : '.minecraft')

    this.logManager = new LogManager(this)
    this.registry.register(LauncherAppKey, this)

    for (const plugin of plugins) {
      plugin(this)
    }

    this.controller = getController(this)
    this.updater = getUpdater(this)

    this.serviceManager = new ServiceManager(this, preloads)
    this.serviceStateManager = new ServiceStateManager(this)
    this.networkManager = new NetworkManager(this, this.serviceManager, this.serviceStateManager)

    this.taskManager = new TaskManager(this)
    this.semaphoreManager = new SemaphoreManager(this)
    this.launcherAppManager = new LauncherAppManager(this)

    this.managers = [this.networkManager, this.taskManager, this.serviceStateManager, this.serviceManager, this.semaphoreManager, this.launcherAppManager, this.logManager]

    const logger = this.logManager.getLogger('App')
    this.log = logger.log
    this.warn = logger.warn
    this.error = logger.error

    this.localhostServerPort = listen(this.server, 25555, (cur) => cur + 7)
  }

  readonly registry: ObjectFactory = new ObjectFactory()
  private initialInstance = ''
  private preferredLocale = ''

  readonly localhostServerPort: Promise<number>

  getAppInstallerStartUpUrl(): string {
    return ''
  }

  getInitialInstance() {
    return this.initialInstance
  }

  getPreferredLocale() {
    return this.preferredLocale
  }

  /**
   * Quit the app gently.
   */
  async quit() {
    this.log('Try to gently close the app')

    try {
      await Promise.race([
        setTimeout(10000).then(() => false),
        Promise.all(this.managers.map(m => m.dispose())).then(() => true),
      ])
    } finally {
      this.host.quit()
    }
  }

  /**
   * Force exit the app with exit code
   */
  exit(code?: number): void {
    this.host.exit(code)
  }

  waitEngineReady(): Promise<void> {
    return this.host.whenReady()
  }

  relaunch(): void { this.host.relaunch() }

  log = (message: any, ...options: any[]) => { }

  warn = (message: any, ...options: any[]) => { }

  error = (message: any, ...options: any[]) => { }

  // setup code

  async start(): Promise<void> {
    await Promise.all([
      this.setup(),
      this.waitEngineReady().then(() => {
        this.onEngineReady()
      })],
    )
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

    this.log(`Boot from ${this.appDataPath}`)

    // register xmcl protocol
    if (!this.host.isDefaultProtocolClient('xmcl')) {
      const result = this.host.setAsDefaultProtocolClient('xmcl')
      if (result) {
        this.log('Successfully register the xmcl protocol')
      } else {
        this.log('Fail to register the xmcl protocol')
      }
    }

    await ensureDir(this.appDataPath)
    await this.logManager.setOutputRoot(this.appDataPath)

    try {
      const self = this as any
      self.gameDataPath = await readFile(join(this.appDataPath, 'root')).then((b) => b.toString().trim())
      this.gamePathMissingSignal.resolve(false)
    } catch (e) {
      if (isSystemError(e) && e.code === 'ENOENT') {
        // first launch
        this.gamePathMissingSignal.resolve(true)
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
      await ensureDir(this.gameDataPath)
    }
    this.gamePathReadySignal.resolve();

    (this.temporaryPath as any) = join(this.gameDataPath, 'temp')
    await ensureDir(this.temporaryPath)
    await Promise.all(this.managers.map(m => m.setup()))
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
    await this.controller.activate(app)
    this.log(`Current launcher core version is ${this.version}.`)
    this.log('App booted')

    await this.gamePathReadySignal.promise
    this.emit('engine-ready')
  }
}

export default LauncherApp
