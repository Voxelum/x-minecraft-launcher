import { getPlatform } from '@xmcl/core'
import { InstalledAppManifest, Platform, createPromiseSignal } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { ensureDir, readFile, writeFile } from 'fs-extra'
import { Server, createServer } from 'http'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { setTimeout } from 'timers/promises'
import { Logger } from '~/logger'
import { IS_DEV, LAUNCHER_NAME } from '../constant'
import { isSystemError } from '../util/error'
import { listen } from '../util/server'
import { createDummyLogger } from './DummyLogger'
import { Host } from './Host'
import { LauncherAppController } from './LauncherAppController'
import { LauncherAppManager } from './LauncherAppManager'
import { LauncherAppPlugin } from './LauncherAppPlugin'
import { LauncherAppUpdater } from './LauncherAppUpdater'
import { LauncherProtocolHandler } from './LauncherProtocolHandler'
import { SecretStorage } from './SecretStorage'
import SemaphoreManager from './SemaphoreManager'
import { Shell } from './Shell'
import { kGameDataPath, kTempDataPath } from './gameDataPath'
import { InjectionKey, ObjectFactory } from './objectRegistry'

export const LauncherAppKey: InjectionKey<LauncherApp> = Symbol('LauncherAppKeyunchAppKey')

export interface LauncherApp {
  on(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  on(channel: 'window-all-closed', listener: () => void): this
  on(channel: 'engine-ready', listener: () => void): this
  on(channel: 'root-migrated', listener: (newRoot: string) => void): this
  on(channel: 'service-call-end', listener: (serviceName: string, serviceMethod: string, duration: number, success: boolean) => void): this
  on(channel: 'service-state-init', listener: (stateKey: string) => void): this

  once(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  once(channel: 'window-all-closed', listener: () => void): this
  once(channel: 'engine-ready', listener: () => void): this
  once(channel: 'root-migrated', listener: (newRoot: string) => void): this
  once(channel: 'service-call-end', listener: (serviceName: string, serviceMethod: string, duration: number, success: boolean) => void): this
  once(channel: 'service-state-init', listener: (stateKey: string) => void): this

  emit(channel: 'app-booted', manifest: InstalledAppManifest): this
  emit(channel: 'service-call-end', serviceName: string, serviceMethod: string, duration: number, success: boolean): this
  emit(channel: 'window-all-closed'): boolean
  emit(channel: 'engine-ready'): boolean
  emit(channel: 'root-migrated', root: string): this
  emit(channel: 'service-state-init', stateKey: string): this
}

export interface LogEmitter extends EventEmitter {
  on(channel: 'info', listener: (destination: string, tag: string, message: string, ...options: any[]) => void): this
  on(channel: 'warn', listener: (destination: string, tag: string, message: string, ...options: any[]) => void): this
  on(channel: 'failure', listener: (destination: string, tag: string, error: Error) => void): this

  emit(channel: 'info', destination: string, tag: string, message: string, ...options: any[]): boolean
  emit(channel: 'warn', destination: string, tag: string, message: string, ...options: any[]): boolean
  emit(channel: 'failure', destination: string, tag: string, error: Error): boolean
}

export class LauncherApp extends EventEmitter {
  /**
   * Launcher %APPDATA%/xmcl path
   */
  readonly appDataPath: string

  /**
   * The .minecraft folder in Windows or minecraft folder in linux/mac
   */
  readonly minecraftDataPath: string

  readonly semaphoreManager: SemaphoreManager
  readonly launcherAppManager: LauncherAppManager
  /**
   * The log event emitter. This should only be used for log consumer like telemetry or log file writer.
   */
  readonly logEmitter: LogEmitter = new EventEmitter()
  /**
   * Current normalized platform information
   */
  readonly platform: Platform
  /**
   * The build number of the launcher
   */
  readonly build: number = Number.parseInt(process.env.BUILD_NUMBER ?? '0', 10)
  /**
   * The version of the launcher
   */
  get version() { return this.host.getVersion() }

  get userAgent() {
    const version = IS_DEV ? '0.0.0' : this.host.getVersion()
    return `voxelum/x_minecraft_launcher/${version} (xmcl.app)`
  }

  /**
   * The launcher server/non-server protocol handler. Register the protocol handler to handle the request.
   */
  readonly protocol = new LauncherProtocolHandler()
  /**
   * The server to handle the launcher server protocol.
   */
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

  /**
   * The actual server port that the server is listening on.
   */
  readonly serverPort: Promise<number>
  /**
   * The controller is response to keep the communication between main process and renderer process
   */
  readonly controller: LauncherAppController
  /**
   * The updater of the launcher
   */
  readonly updater: LauncherAppUpdater
  /**
   * The app object registry for DI
   */
  readonly registry: ObjectFactory = new ObjectFactory()
  /**
    * The game data path is the root of the game data. It's the path where the game data is stored.
    *
    * This will be set by user.
    */
  #gamePath: string = ''
  /**
   * Whether the app is bootstrapping. If it's bootstrapping, it will start window with bootstrap search param.
   */
  #isBootstrapSignal = createPromiseSignal<boolean>()
  /**
   * The disposers to dispose when the app is going to quit.
   */
  #disposers: (() => Promise<void>)[] = []

  protected logger: Logger = this.getLogger('App')

  constructor(
    readonly host: Host,
    readonly shell: Shell,
    readonly secretStorage: SecretStorage,
    getController: (app: LauncherApp) => LauncherAppController,
    getUpdater: (app: LauncherApp) => LauncherAppUpdater,
    readonly builtinAppManifest: InstalledAppManifest,
    readonly env: string,
    plugins: LauncherAppPlugin[],
  ) {
    super()
    const appData = host.getPath('appData')

    const plat = getPlatform()
    this.platform = {
      os: plat.name === 'unknown'
        ? process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
        : plat.name,
      osRelease: plat.version,
      arch: plat.arch as any,
    }
    this.appDataPath = join(appData, LAUNCHER_NAME)
    this.minecraftDataPath = join(appData, this.platform.os === 'osx' ? 'minecraft' : '.minecraft')

    this.registry.register(LauncherAppKey, this)
    this.controller = getController(this)
    this.updater = getUpdater(this)

    this.semaphoreManager = new SemaphoreManager(this)
    this.launcherAppManager = new LauncherAppManager(this)

    for (const plugin of plugins) {
      try {
        plugin(this, builtinAppManifest)
      } catch (e) {
        this.logger.warn(`Fail to load plugin ${plugin.name}`)
        this.logger.error(e as any)
      }
    }

    this.serverPort = listen(this.server, 25555, (cur) => cur + 7).then((port) => {
      this.logger.log(`Localhost server is listening on port ${port}`)
      return port
    })
  }

  getAppInstallerStartUpUrl(): string {
    return ''
  }

  getLogger(tag: string, destination = 'main'): Logger {
    return createDummyLogger(tag, destination, this.logEmitter)
  }

  registryDisposer(disposer: () => Promise<void>) {
    this.#disposers.push(disposer)
  }

  async dispose() {
    await Promise.all(this.#disposers.map(m => m().catch(() => { })))
  }

  /**
   * Quit the app gently.
   */
  async quit() {
    this.logger.log('Try to gently close the app')

    try {
      await Promise.race([
        setTimeout(10000).then(() => false),
        Promise.all(this.#disposers.map(m => m())).then(() => true),
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

  // setup code

  async start(): Promise<void> {
    await Promise.all([
      this.setup(),
      this.host.whenReady().then(() => {
        this.emit('engine-ready')
        return this.onEngineReady()
      }),
    ])
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

    this.logger.log(`Boot from ${this.appDataPath}`)

    // register xmcl protocol
    if (!this.host.isDefaultProtocolClient('xmcl')) {
      const result = this.host.setAsDefaultProtocolClient('xmcl')
      if (result) {
        this.logger.log('Successfully register the xmcl protocol')
      } else {
        this.logger.log('Fail to register the xmcl protocol')
      }
    }

    await ensureDir(this.appDataPath)

    let gameDataPath: string
    try {
      gameDataPath = await readFile(join(this.appDataPath, 'root')).then((b) => b.toString().trim())
      this.#isBootstrapSignal.resolve(false)
    } catch (e) {
      if (isSystemError(e) && e.code === 'ENOENT') {
        // first launch
        this.#isBootstrapSignal.resolve(true)
        const path = await new Promise<string>((resolve) => {
          this.controller.handle('bootstrap', (_, path) => {
            resolve(path)
          }, true)
        })
        gameDataPath = (path)
        await writeFile(join(this.appDataPath, 'root'), path)
      } else {
        this.#isBootstrapSignal.resolve(false)
        gameDataPath = (this.appDataPath)
      }
    }

    try {
      await ensureDir(gameDataPath)
      await this.#registerGamePath(gameDataPath)
    } catch {
      gameDataPath = this.appDataPath
      await ensureDir(gameDataPath)
      await this.#registerGamePath(gameDataPath)
    }
  }

  async #registerGamePath(gamePath: string) {
    this.#gamePath = gamePath
    this.registry.register(kGameDataPath, (...args) => {
      return join(this.#gamePath, ...args)
    })

    const temporaryPath = join(this.#gamePath, 'temp')
    await ensureDir(temporaryPath)

    this.registry.register(kTempDataPath, (...args) => {
      return join(this.#gamePath, 'temp', ...args)
    })
  }

  async migrateRoot(newRoot: string) {
    await writeFile(join(this.appDataPath, 'root'), newRoot)
    this.#gamePath = newRoot
    this.emit('root-migrated', newRoot)
  }

  protected async getStartupUrl(): Promise<string | undefined> {
    if (!IS_DEV && process.platform === 'win32') {
      this.logger.log(`Try to check the start up url: ${process.argv.join(' ')}`)
      if (process.argv.length > 1) {
        const urlOption = process.argv.find(a => a.startsWith('--url='))
        if (urlOption) {
          const url = urlOption.substring('--url='.length)
          if (url) {
            return url
          }
        }
        this.logger.log('Didn\'t find --url options')
        const protocolOption = process.argv.find(a => a.startsWith('xmcl://'))
        if (protocolOption) {
          const u = new URL(protocolOption)
          if (u.host === 'launcher' && u.pathname === '/app' && u.searchParams.has('url')) {
            return u.searchParams.get('url') as string
          }
        }
        this.logger.log('Didn\'t find xmcl:// protocol')
      }
    }
    this.logger.log('Didn\'t find the start up url, try to load from config file.')

    try {
      const { default: url } = JSON.parse(await readFile(join(this.launcherAppManager.root, 'apps.json'), 'utf-8'))

      return url
    } catch (e) {
      if (isSystemError(e) && e.code === 'ENOENT') {
        return undefined
      }
      throw e
    }
  }

  protected async onEngineReady() {
    this.logger.log(`cwd: ${process.cwd()}. env: ${process.env.NODE_ENV}`)

    // start the app
    let app: InstalledAppManifest
    try {
      const url = await this.getStartupUrl()
      if (url) {
        this.logger.log(`Try to use start up url ${url}`)
        const existedApp = await this.launcherAppManager.tryGetInstalledApp(url)
        if (existedApp) {
          app = existedApp
        } else {
          app = await this.launcherAppManager.installApp(url)
        }
      } else {
        throw new Error('No start up url')
      }
    } catch (e) {
      if ((e as any).message !== 'No start up url') {
        this.logger.warn('Fail to use start up url:')
        this.logger.warn(e)
      }
      try {
        const startUp = this.getAppInstallerStartUpUrl()
        if (startUp) {
          this.logger.log(`Try to use appinstaller startup url: "${startUp}"`)
          app = await this.launcherAppManager.installApp(startUp)
        } else {
          app = this.builtinAppManifest
        }
      } catch (e) {
        app = this.builtinAppManifest
      }
    }
    const isBootstrap = await this.#isBootstrapSignal.promise
    await this.controller.activate(app, isBootstrap)
    this.logger.log(`Current launcher core version is ${this.version}.`)
    this.logger.log('App booted')
  }

  fetch = fetch
}
