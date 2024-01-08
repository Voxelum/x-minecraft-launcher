import { AccentState, HAS_DEV_SERVER, HOST, IS_DEV, WindowsBuild } from '@/constant'
import browsePreload from '@preload/browse'
import indexPreload from '@preload/index'
import monitorPreload from '@preload/monitor'
import browserWinUrl from '@renderer/browser.html'
import loggerWinUrl from '@renderer/logger.html'
import { InstalledAppManifest, Settings } from '@xmcl/runtime-api'
import { Client, LauncherAppController } from '@xmcl/runtime/app'
import { Logger } from '@xmcl/runtime/logger'
import { kUserAgent } from '@xmcl/runtime/network'
import { kSettings } from '@xmcl/runtime/settings'
import { UserService } from '@xmcl/runtime/user'
import { BrowserWindow, DidCreateWindowDetails, Event, HandlerDetails, Session, Tray, WebContents, dialog, ipcMain, nativeTheme, protocol, session, shell } from 'electron'
import { createReadStream } from 'fs'
import { readFile } from 'fs-extra'
import { join } from 'path'
import { Readable } from 'stream'
import ElectronLauncherApp from './ElectronLauncherApp'
import { plugins } from './controllers'
import { definedLocales } from './definedLocales'
import { createI18n } from './utils/i18n'
import { darkIcon } from './utils/icons'
import { trackWindowSize } from './utils/windowSizeTracker'

export class ElectronController implements LauncherAppController {
  protected windowsVersion?: { major: number; minor: number; build: number }

  protected mainWin: BrowserWindow | undefined = undefined

  protected loggerWin: BrowserWindow | undefined = undefined

  protected browserRef: BrowserWindow | undefined = undefined

  protected i18n = createI18n(definedLocales, 'en')

  private logger: Logger

  protected tray: Tray | undefined

  /**
   * During the app is parking, even if the all windows are closed, the app will keep open.
   */
  protected parking = false

  protected activatedManifest: InstalledAppManifest | undefined

  protected sharedSession: Session | undefined

  private settings: Settings | undefined

  private windowOpenHandler: Parameters<WebContents['setWindowOpenHandler']>[0] = (detail: HandlerDetails) => {
    const url = new URL(detail.url)
    if (url.host === 'app' || detail.frameName === '' || detail.frameName === 'app') {
      const man = this.activatedManifest!
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          vibrancy: man.vibrancy ? 'sidebar' : undefined, // or popover
          icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
          titleBarStyle: this.getTitlebarStyle(),
          trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
          minWidth: 600,
          minHeight: 600,
          width: 1024,
          height: 768,
          show: false,
          frame: this.getFrameOption(),

          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            preload: indexPreload,
            devTools: IS_DEV,
          },
        },
      }
    }

    shell.openExternal(detail.url)
    return { action: 'deny' }
  }

  private onWebContentCreateWindow = (window: BrowserWindow,
    details: DidCreateWindowDetails) => {
    window.webContents.setWindowOpenHandler(this.windowOpenHandler)
    window.webContents.on('will-navigate', this.onWebContentWillNavigate)
    window.webContents.on('did-create-window', this.onWebContentCreateWindow)
    window.once('ready-to-show', () => {
      window.show()
    })
  }

  private onWebContentWillNavigate = (event: Event, url: string) => {
    if (!url.startsWith(HAS_DEV_SERVER ? 'http://localhost' : ('http://' + HOST))) {
      event.preventDefault()
      shell.openExternal(url)
    }
  }

  constructor(protected app: ElectronLauncherApp) {
    plugins.forEach(p => p.call(this))

    if (app.platform.os === 'windows') {
      this.windowsVersion = app.windowsUtils?.getWindowsVersion()
    }

    this.app.on('window-all-closed', () => {
      if (process.platform !== 'darwin' && !this.parking) {
        this.app.quit()
      }
    })

    this.logger = this.app.getLogger('Controller')

    protocol.registerSchemesAsPrivileged([{
      scheme: 'image',
      privileges: {
        stream: true,
        corsEnabled: true,
        supportFetchAPI: true,
        bypassCSP: true,
      },
    }])

    protocol.registerSchemesAsPrivileged([{
      scheme: 'video',
      privileges: {
        stream: true,
        corsEnabled: true,
        supportFetchAPI: true,
        bypassCSP: true,
      },
    }])
  }

  handle(channel: string, handler: (event: { sender: Client }, ...args: any[]) => any) {
    return ipcMain.handle(channel, handler)
  }

  broadcast(channel: string, ...payload: any[]): void {
    BrowserWindow.getAllWindows().forEach(w => {
      try {
        w.webContents.send(channel, ...payload)
      } catch (e) {
        this.logger.warn(`Drop message to ${channel} to ${w.getTitle()} as`)
        if (e instanceof Error) {
          this.logger.warn(e)
        }
      }
    })
  }

  private setupBrowserLogger(ref: BrowserWindow, name: string) {
    const logger = this.app.getLogger('All', name)
    const tagName = `renderer-${name}`
    ref.webContents.on('console-message', (e, level, message, line, id) => {
      if (level === 1) {
        logger.log(tagName, message)
      } else if (level === 2) {
        logger.warn(tagName, message)
      } else if (level === 3) {
        logger.warn(tagName, message)
      }
    })
    ref.once('close', () => {
      ref.webContents.removeAllListeners('console-message')
    })
  }

  private setWindowBlurEffect(browser: BrowserWindow) {
    const isWin = this.app.platform.os === 'windows'
    if (isWin && this.app.windowsUtils) {
      const handle = browser.getNativeWindowHandle()
      const windowsVersion = this.windowsVersion
      if (windowsVersion) {
        if (windowsVersion.build >= WindowsBuild.Windows11) {
          this.app.windowsUtils.setMica(handle.buffer, true)
          this.logger.log(`Set window Mica ${handle.toString('hex')}`)
        } else {
          let blur: AccentState
          if (windowsVersion.build >= WindowsBuild.Windows10Build1903) {
            blur = AccentState.ACCENT_ENABLE_BLURBEHIND
          } else if (windowsVersion.build >= WindowsBuild.Windows10Build1809) {
            blur = AccentState.ACCENT_ENABLE_ACRYLICBLURBEHIND
          } else if (windowsVersion.build >= WindowsBuild.Windows10) {
            blur = AccentState.ACCENT_ENABLE_BLURBEHIND
          } else {
            blur = AccentState.ACCENT_ENABLE_TRANSPARENTGRADIENT
          }
          if (this.app.windowsUtils.setWindowBlur(handle.buffer, blur)) {
            this.logger.log(`Set window Acrylic transparent ${handle.toString('hex')}`)
          } else {
            this.logger.warn(`Set window Acrylic failed ${handle.toString('hex')}`)
          }
        }
      }
    }
  }

  private getSharedSession(userAgent: string) {
    if (this.sharedSession) {
      return this.sharedSession
    }

    const restoredSession = session.fromPartition('persist:main')
    restoredSession.setUserAgent(userAgent)

    for (const e of session.defaultSession.getAllExtensions()) {
      restoredSession.loadExtension(e.path)
    }

    restoredSession.webRequest.onHeadersReceived((detail, cb) => {
      if (detail.responseHeaders &&
        !detail.responseHeaders['access-control-allow-origin'] &&
        !detail.responseHeaders['Access-Control-Allow-Origin']) {
        detail.responseHeaders['access-control-allow-origin'] = ['*']
      }

      cb({ responseHeaders: detail.responseHeaders })
    })

    restoredSession.webRequest.onBeforeSendHeaders((detail, cb) => {
      if (detail.requestHeaders) {
        detail.requestHeaders['User-Agent'] = userAgent
      }
      if (detail.url.startsWith('https://api.xmcl.app/modrinth') ||
        detail.url.startsWith('https://api.xmcl.app/curseforge')
      ) {
        this.app.registry.get(UserService).then(userService => {
          userService.getOfficialUserProfile().then(profile => {
            if (profile && profile.accessToken) {
              detail.requestHeaders.Authorization = `Bearer ${profile.accessToken}`
            }
            cb({ requestHeaders: detail.requestHeaders })
          }).catch(() => {
            cb({ requestHeaders: detail.requestHeaders })
          })
        }).catch(e => {
          cb({ requestHeaders: detail.requestHeaders })
        })
      } else if (detail.url.startsWith('https://api.curseforge.com')) {
        detail.requestHeaders['x-api-key'] = process.env.CURSEFORGE_API_KEY || ''
        cb({ requestHeaders: detail.requestHeaders })
      } else {
        cb({ requestHeaders: detail.requestHeaders })
      }
    })

    const handler = async (request: Request): Promise<Response> => {
      const url = new URL(request.url)
      if (url.host === HOST && !HAS_DEV_SERVER) {
        const realPath = join(__dirname, 'renderer', url.pathname)
        const mimeType =
          url.pathname.endsWith('.js')
            ? 'text/javascript'
            : url.pathname.endsWith('.css')
              ? 'text/css'
              : url.pathname.endsWith('.html')
                ? 'text/html'
                : url.pathname.endsWith('.json')
                  ? 'application/json'
                  : url.pathname.endsWith('.png')
                    ? 'image/png'
                    : url.pathname.endsWith('.svg')
                      ? 'image/svg+xml'
                      : url.pathname.endsWith('.ico')
                        ? 'image/x-icon'
                        : url.pathname.endsWith('.woff')
                          ? 'font/woff'
                          : url.pathname.endsWith('.woff2')
                            ? 'font/woff2'
                            : url.pathname.endsWith('.ttf')
                              ? 'font/ttf'
                              // webp
                              : url.pathname.endsWith('.webp') ? 'image/webp' : ''
        return new Response(Readable.toWeb(createReadStream(realPath)) as any, {
          headers: {
            'Content-Type': mimeType,
          },
        })
      }
      const response = await this.app.protocol.handle({
        url: new URL(url),
        method: request.method,
        headers: request.headers,
        body: request.body ? Readable.fromWeb(request.body as any) : request.body as any,
      })
      return new Response(response.body instanceof Readable ? Readable.toWeb(response.body) as any : response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    restoredSession.protocol.handle('http', handler)
    this.sharedSession = restoredSession

    return restoredSession
  }

  async activate(manifest: InstalledAppManifest): Promise<void> {
    this.logger.log(`Activate app ${manifest.name} ${manifest.url}`)
    this.parking = true

    // close the old window
    if (this.mainWin && !this.mainWin.isDestroyed()) {
      this.mainWin.close()
    }

    this.activatedManifest = manifest

    try {
      await this.createAppWindow(this.app.launcherAppManager.getAppRoot(manifest.url))
    } finally {
      this.parking = false
    }
  }

  async createBrowseWindow() {
    const browser = new BrowserWindow({
      title: 'XMCL Launcher Browser',
      frame: false,
      transparent: true,
      resizable: false,
      width: 860,
      height: 450,
      useContentSize: true,
      vibrancy: 'sidebar', // or popover
      icon: darkIcon,
      webPreferences: {
        preload: browsePreload,
      },
    })

    browser.loadURL(browserWinUrl)
    browser.on('ready-to-show', () => {
      this.setWindowBlurEffect(browser)
    })

    this.browserRef = browser
  }

  async createAppWindow(appDir: string) {
    const man = this.activatedManifest!
    const configPath = man === this.app.builtinAppManifest ? join(this.app.appDataPath, 'main-window-config.json') : join(appDir, 'window-config.json')
    this.logger.log(`Creating app window by config ${configPath}`)
    const configData = await readFile(configPath, 'utf-8').then((v) => JSON.parse(v)).catch(() => ({
      width: -1,
      height: -1,
      x: null,
      y: null,
    }))
    const config = {
      width: typeof configData.width === 'number' ? configData.width as number : -1,
      height: typeof configData.height === 'number' ? configData.height as number : -1,
      x: typeof configData.x === 'number' ? configData.x as number : null,
      y: typeof configData.y === 'number' ? configData.y as number : null,
    }

    const ua = await this.app.registry.get(kUserAgent)
    const restoredSession = this.getSharedSession(ua)
    const minWidth = man.minWidth ?? 800
    const minHeight = man.minHeight ?? 600

    // Ensure the settings is loaded
    if (this.app.platform.os === 'linux' && !this.settings) {
      if (!await this.app.isGameDataPathMissing()) {
        this.settings = await this.app.registry.get(kSettings)
      }
    }

    const browser = new BrowserWindow({
      title: man.name,
      width: config.width > 0 ? config.width : undefined,
      height: config.height > 0 ? config.height : undefined,
      minWidth: man.minWidth,
      minHeight: man.minHeight,
      frame: this.getFrameOption(),
      backgroundColor: man.backgroundColor,
      vibrancy: man.vibrancy ? 'sidebar' : undefined, // or popover
      icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
      titleBarStyle: this.getTitlebarStyle(),
      trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
      webPreferences: {
        preload: indexPreload,
        session: restoredSession,
        webviewTag: true,
      },
      show: false,
    })

    if (man.ratio) {
      browser.setAspectRatio(minWidth / minHeight)
    }

    this.logger.log(`Created app window by config ${configPath}`)
    browser.on('ready-to-show', () => {
      this.logger.log('App Window is ready to show!')

      if (man.vibrancy) {
        this.setWindowBlurEffect(browser)
      }

      browser.show()
      browser.focus()
    })
    browser.webContents.on('will-navigate', this.onWebContentWillNavigate)
    browser.webContents.on('did-create-window', this.onWebContentCreateWindow)
    browser.webContents.setWindowOpenHandler(this.windowOpenHandler)

    this.setupBrowserLogger(browser, 'app')

    trackWindowSize(browser, config, configPath)

    let url = man.url
    if (await this.app.isGameDataPathMissing()) {
      url += '?setup'
    }
    this.logger.log(url)
    browser.loadURL(url)

    this.logger.log(`Load main window url ${url}`)

    this.mainWin = browser

    this.app.emit('app-booted', man)
  }

  createMonitorWindow() {
    const browser = new BrowserWindow({
      title: 'KeyStone Monitor',
      width: 770,
      height: 580,
      minWidth: 600,
      minHeight: 400,
      frame: false,
      transparent: true,
      hasShadow: false,
      maximizable: false,
      icon: darkIcon,
      webPreferences: {
        preload: monitorPreload,
        session: session.fromPartition('persist:logger'),
      },
    })

    this.setupBrowserLogger(browser, 'logger')
    this.setWindowBlurEffect(browser)

    browser.loadURL(loggerWinUrl)
    browser.show()

    this.loggerWin = browser
  }

  requireFocus(): void {
    if (this.mainWin) {
      this.mainWin.focus()
    } else if (this.loggerWin) {
      this.loggerWin.focus()
    }
  }

  async requestOpenExternalUrl(url: string) {
    const { t } = this.i18n
    const result = await dialog.showMessageBox(this.mainWin!, {
      type: 'question',
      title: t('openUrl.title', { url }),
      message: t('openUrl.message', { url }),
      checkboxLabel: t('openUrl.trust'),
      buttons: [t('openUrl.cancel'), t('openUrl.yes')],
    })
    return result.response === 1
  }

  async processFirstLaunch(): Promise<{ path: string; instancePath: string; locale: string }> {
    return new Promise<{ path: string; instancePath: string; locale: string }>((resolve) => {
      ipcMain.handleOnce('bootstrap', (_, path, instancePath, locale) => {
        resolve({ path, instancePath, locale })
      })
    })
  }

  private getFrameOption() {
    if (this.app.platform.os === 'linux') {
      return this.settings?.linuxTitlebar
    } else {
      return true
    }
  }

  private getTitlebarStyle() {
    return this.app.platform.os === 'linux' &&
      this.settings?.linuxTitlebar
      ? 'default'
      : 'hidden'
  }

  get activeWindow() {
    return this.mainWin ?? this.loggerWin
  }

  openDevTools() {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.closeDevTools()
      win.webContents.openDevTools()
    }
  }
}
