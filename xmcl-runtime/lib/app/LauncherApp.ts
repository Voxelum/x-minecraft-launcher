import { getPlatform } from '@xmcl/core'
import { InstalledAppManifest, ReleaseInfo } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { EventEmitter } from 'events'
import { ensureDir, readFile, readFileSync, writeFile } from 'fs-extra'
import { join } from 'path'
import { setTimeout } from 'timers/promises'
import { URL } from 'url'
import { IS_DEV, LAUNCHER_NAME } from '../constant'
import { Client } from '../engineBridge'
import { Manager } from '../managers'
import LogManager from '../managers/LogManager'
import NetworkManager from '../managers/NetworkManager'
import SemaphoreManager from '../managers/SemaphoreManager'
import ServiceManager from '../managers/ServiceManager'
import ServiceStateManager from '../managers/ServiceStateManager'
import TaskManager from '../managers/TaskManager'
import TelemetryManager from '../managers/TelemetryManager'
import WorkerManager from '../managers/WorkerManager'
import { OfficialUserService } from '../services/OfficialUserService'
import { AbstractService, ServiceConstructor } from '../services/Service'
import { isSystemError } from '../util/error'
import { createPromiseSignal } from '../util/promiseSignal'
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
  on(channel: 'peer-join', listener: (info: { description: string; type: 'offer' | 'answer' }) => void): this
  on(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  on(channel: 'window-all-closed', listener: () => void): this
  on(channel: 'service-ready', listener: (service: AbstractService) => void): this
  on(channel: 'engine-ready', listener: () => void): this

  once(channel: 'peer-join', listener: (info: { description: string; type: 'offer' | 'answer' }) => void): this
  once(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  once(channel: 'window-all-closed', listener: () => void): this
  once(channel: 'service-ready', listener: (service: AbstractService) => void): this
  once(channel: 'engine-ready', listener: () => void): this

  emit(channel: 'peer-join', info: { description: string; type: 'offer' | 'answer' }): this
  emit(channel: 'app-booted', manifest: InstalledAppManifest): this
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

  readonly logManager: LogManager
  readonly serviceManager: ServiceManager
  readonly serviceStateManager: ServiceStateManager
  readonly taskManager: TaskManager
  readonly telemetryManager: TelemetryManager
  readonly workerManager: WorkerManager
  readonly semaphoreManager: SemaphoreManager
  readonly launcherAppManager: LauncherAppManager

  readonly platform: Platform = getPlatform()

  readonly build: number = Number.parseInt(process.env.BUILD_NUMBER ?? '0', 10)

  readonly env = process.env.BUILD_TARGET === 'appx' ? 'appx' : process.env.BUILD_TARGET === 'appimage' ? 'appimage' : 'raw'

  get version() { return this.getHost().getVersion() }

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

    this.logManager = new LogManager(this)

    this.serviceManager = new ServiceManager(this, this.getPreloadServices())
    this.serviceStateManager = new ServiceStateManager(this)
    this.networkManager = new NetworkManager(this, this.serviceManager, this.serviceStateManager)

    this.taskManager = new TaskManager(this)
    this.telemetryManager = new TelemetryManager(this)
    this.workerManager = new WorkerManager(this)
    this.semaphoreManager = new SemaphoreManager(this)
    this.launcherAppManager = new LauncherAppManager(this)

    this.managers = [this.networkManager, this.taskManager, this.serviceStateManager, this.serviceManager, this.telemetryManager, this.workerManager, this.semaphoreManager, this.launcherAppManager, this.logManager]

    const logger = this.logManager.getLogger('App')
    this.log = logger.log
    this.warn = logger.warn
    this.error = logger.error
  }

  private initialInstance = ''
  private preferredLocale = ''

  readonly localhostAuthServerPort = createPromiseSignal<number>()

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

  getLocaleCountryCode(): string { return this.host.getLocaleCountryCode() }

  /**
   * Handle the url activate the app
   * @param url The url input
   */
  handleUrl(url: string) {
    if (url.startsWith('authlib-injector:yggdrasil-server:')) {
      const serverUrl = decodeURIComponent(url.substring('authlib-injector:yggdrasil-server:'.length))
      const parsed = new URL(serverUrl)
      const domain = parsed.host
      // const userService = this.serviceManager.get(YggdrasilUserService)
      // userService.registerFirstPartyApi(domain, {
      //   hostName: serverUrl,
      //   authenticate: '/authserver/authenticate',
      //   refresh: '/authserver/refresh',
      //   validate: '/authserver/validate',
      //   invalidate: '/authserver/invalidate',
      //   signout: '/authserver/signout',
      // }, {
      //   profile: `${serverUrl}/sessionserver/session/minecraft/profile/\${uuid}`,
      //   profileByName: `${serverUrl}/users/profiles/minecraft/\${name}`,
      //   texture: `${serverUrl}/user/profile/\${uuid}/\${type}`,
      // })
      // userService.emit('auth-profile-added', domain)
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
      const userService = this.serviceManager.get(OfficialUserService)
      userService.emit('microsoft-authorize-code', error, code)
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
  async quit() {
    this.log('Try to gently close the app')

    try {
      await Promise.race([
        setTimeout(1000).then(() => false),
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

  /**
   * Get the system provided path
   */
  getPath(key: 'home' | 'appData' | 'userData' | 'sessionData' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'recent' | 'logs' | 'crashDumps'): string {
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

  log = (message: any, ...options: any[]) => { }

  warn = (message: any, ...options: any[]) => { }

  error = (message: any, ...options: any[]) => { }

  // setup code

  async start(): Promise<void> {
    // const proxy = new ProxyDispatcher({
    //   factory(connect) {
    //     const downloadAgent = new Agent({
    //       bodyTimeout: 15_000,
    //       headersTimeout: 10_000,
    //       connectTimeout: 10_000,
    //       connect,
    //       factory(origin, opts: Agent.Options) {
    //         const dispatcher = new Pool(origin, opts)
    //         const keys = Reflect.ownKeys(dispatcher)
    //         const sym = keys.find(k => typeof k === 'symbol' && k.description === 'connections')
    //         if (sym) { Object.defineProperty(dispatcher, sym, { get: () => 16 }) }
    //         return dispatcher
    //       },
    //     })
    //     const apiAgent = new Agent({
    //       pipelining: 6,
    //       bodyTimeout: 10_000,
    //       headersTimeout: 10_000,
    //       connectTimeout: 10_000,
    //       connect,
    //       factory(origin, opts: Agent.Options) {
    //         let dispatcher: Dispatcher | undefined
    //         // for (const factory of apiClientFactories) { dispatcher = factory(origin, opts) }
    //         if (!dispatcher) { dispatcher = new Pool(origin, opts) }
    //         if (dispatcher instanceof Pool) {
    //           const keys = Reflect.ownKeys(dispatcher)
    //           const kConnections = keys.find(k => typeof k === 'symbol' && k.description === 'connections')
    //           if (kConnections) { Object.defineProperty(dispatcher, kConnections, { get: () => 16 }) }
    //         }
    //         return dispatcher
    //       },
    //     })
    //     return new BiDispatcher(downloadAgent, apiAgent)
    //   },
    // })

    // const dispatcher = new CacheDispatcher(proxy, new JsonCacheStorage({
    //   get(k) { return store[k] },
    //   async put(k, v) { store[k] = v },
    // }))
    // {
    //   const res = request('https://authserver.ely.by/api/authlib-injector/sessionserver/session/minecraft/profile/42a0074dea15474cb7933bf0ad55fd75?unsigned=true', {
    //     method: 'GET',
    //     dispatcher,
    //   })
    // }
    // {
    //   const res = request('https://authserver.ely.by/api/authlib-injector/sessionserver/session/minecraft/profile/42a0074dea15474cb7933bf0ad55fd75?unsigned=true', {
    //     method: 'GET',
    //     dispatcher,
    //   })
    // }

    // const store: Record<string, any> = {}
    // const form = new FormData()
    // form.append('file', readFileSync('C:\\Users\\CIJhn\\Documents\\CI010.png'), { contentType: 'image/png', filename: 'CI010.png' })
    // form.append('model', 'steve')
    // const response = await request('https://authserver.ely.by/api/authlib-injector/api/user/profile/42a0074dea15474cb7933bf0ad55fd75/skin', {
    //   method: 'PUT',
    //   body: form.getBuffer(),
    //   headers: {
    //     ...form.getHeaders(),
    //     authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJpYXQiOjE2NjQ5ODEwNDUsImV4cCI6MTY2NTE1Mzg0NSwic2NvcGUiOiJtaW5lY3JhZnRfc2VydmVyX3Nlc3Npb24iLCJlbHktY2xpZW50LXRva2VuIjoiYV9wb0l5aWxwaDBYaHpvY1kweUt6VHlkcm5wSTUwMzM0SUJILS1VM3pveU91OTlyY2UwenlMTm1DMXNOODlLTnFIZERSaU5ZQUZXcklXSHA3NTBvSlZtT1hIdXRVczFJIiwic3ViIjoiZWx5fDQwODMzOTMifQ.JkKj5RIcLodvFHTPnTWYcas3y4sBFziwv8ptgRj3fXSlWdLzwOPswi775u3Sh_RRnlL5yCWYIFH9AlPA3iSOZQ',
    //   },
    //   dispatcher: dispatcher,
    // })

    // const text = await response.body.text()
    // console.log(text)

    await Promise.all([
      this.setup(),
      this.waitEngineReady().then(() => {
        this.onEngineReady()
      })],
    )
  }

  readonly gamePathReadySignal = createPromiseSignal()
  readonly gamePathMissingSignal = createPromiseSignal<boolean>()

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
