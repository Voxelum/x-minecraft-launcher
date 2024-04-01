import { getPlatform } from '@xmcl/core'
import { InstalledAppManifest, Platform, createPromiseSignal } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { ensureDir, readFile, writeFile } from 'fs-extra'
import { Server, createServer } from 'http'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { setTimeout } from 'timers/promises'
import { URL } from 'url'
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
  readonly logEmitter: LogEmitter = new EventEmitter()

  readonly platform: Platform

  readonly build: number = Number.parseInt(process.env.BUILD_NUMBER ?? '0', 10)

  get version() { return this.host.getVersion() }

  /**
   * The launcher server protocol handler
   */
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

  /**
   * The controller is response to keep the communication between main process and renderer process
   */
  readonly controller: LauncherAppController
  /**
   * The updater of the launcher
   */
  readonly updater: LauncherAppUpdater

  readonly registry: ObjectFactory = new ObjectFactory()
  private preferredLocale = ''
  private gamePathSignal = createPromiseSignal<string>()
  private gamePathMissingSignal = createPromiseSignal<boolean>()
  protected logger: Logger = this.getLogger('App')

  readonly localhostServerPort: Promise<number>

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
      os: plat.name,
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

    this.localhostServerPort = listen(this.server, 25555, (cur) => cur + 7).then((port) => {
      this.logger.log(`Localhost server is listening on port ${port}`)
      return port
    })
  }

  getAppInstallerStartUpUrl(): string {
    return ''
  }

  getPreferredLocale() {
    return this.preferredLocale
  }

  getGameDataPath() {
    return this.gamePathSignal.promise
  }

  isGameDataPathMissing() {
    return this.gamePathMissingSignal.promise
  }

  getLogger(tag: string, destination = 'main'): Logger {
    return createDummyLogger(tag, destination, this.logEmitter)
  }

  private disposers: (() => Promise<void>)[] = []
  registryDisposer(disposer: () => Promise<void>) {
    this.disposers.push(disposer)
  }

  async dispose() {
    await Promise.all(this.disposers.map(m => m().catch(() => { })))
  }

  /**
   * Quit the app gently.
   */
  async quit() {
    this.logger.log('Try to gently close the app')

    try {
      await Promise.race([
        setTimeout(10000).then(() => false),
        Promise.all(this.disposers.map(m => m())).then(() => true),
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
      this.gamePathMissingSignal.resolve(false)
    } catch (e) {
      if (isSystemError(e) && e.code === 'ENOENT') {
        // first launch
        this.gamePathMissingSignal.resolve(true)
        const { path, instancePath, locale } = await this.controller.processFirstLaunch()
        this.preferredLocale = locale
        gameDataPath = (path)
        await writeFile(join(this.appDataPath, 'root'), path)
      } else {
        this.gamePathMissingSignal.resolve(false)
        gameDataPath = (this.appDataPath)
      }
    }

    try {
      await ensureDir(gameDataPath)
      this.gamePathSignal.resolve(gameDataPath)
    } catch {
      gameDataPath = this.appDataPath
      await ensureDir(gameDataPath)
      this.gamePathSignal.resolve(gameDataPath)
    }
  }

  async migrateRoot(newRoot: string) {
    this.gamePathSignal = createPromiseSignal<string>()
    this.gamePathSignal.resolve(newRoot)
    await writeFile(join(this.appDataPath, 'root'), newRoot)
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
    await this.controller.activate(app)
    this.logger.log(`Current launcher core version is ${this.version}.`)
    this.logger.log('App booted')
  }
}
