import { AccentState, HAS_DEV_SERVER, HOST, IS_DEV, WindowsBuild } from '@/constant'
import browsePreload from '@preload/browse'
import indexPreload from '@preload/index'
import migrationPreload from '@preload/migration'
import monitorPreload from '@preload/monitor'
import multiplayerPreload from '@preload/multiplayer'
import browserWinUrl from '@renderer/browser.html'
import loggerWinUrl from '@renderer/logger.html'
import migrateWinUrl from '@renderer/migration.html'
import { InstalledAppManifest, Settings } from '@xmcl/runtime-api'
import { Client, LauncherAppController } from '@xmcl/runtime/app'
import { Logger } from '@xmcl/runtime/logger'
import { kSettings } from '@xmcl/runtime/settings'
import { BrowserWindow, Event, HandlerDetails, Session, Tray, WebContents, dialog, ipcMain, nativeTheme, protocol, shell } from 'electron'
import ElectronLauncherApp from './ElectronLauncherApp'
import { plugins } from './controllers'
import defaultApp from './defaultApp'
import { definedLocales } from './definedLocales'
import { createI18n } from './utils/i18n'
import { darkIcon } from './utils/icons'
import { getLoginSuccessHTML } from './utils/login'
import { createWindowTracker } from './utils/windowSizeTracker'

export class ElectronController implements LauncherAppController {
  protected windowsVersion?: { major: number; minor: number; build: number }

  protected mainWin: BrowserWindow | undefined = undefined

  protected loggerWin: BrowserWindow | undefined = undefined

  protected browserRef: BrowserWindow | undefined = undefined

  protected multiplayerRef: BrowserWindow | undefined = undefined

  protected migrationRef: BrowserWindow | undefined = undefined

  protected i18n = createI18n(definedLocales, 'en')

  readonly logger: Logger

  protected tray: Tray | undefined

  /**
   * During the app is parking, even if the all windows are closed, the app will keep open.
   */
  protected parking = false

  protected activatedManifest: InstalledAppManifest | undefined

  protected sharedSession: Session | undefined

  private settings: Settings | undefined

  private migrated: { from: string; to: string } | undefined

  private windowOpenHandler: Parameters<WebContents['setWindowOpenHandler']>[0] = (detail: HandlerDetails) => {
    const url = new URL(detail.url)
    const features = detail.features.split(',')
    const width = parseInt(features.find(f => f.startsWith('width'))?.split('=')[1] ?? '1024', 10)
    const height = parseInt(features.find(f => f.startsWith('height'))?.split('=')[1] ?? '768', 10)
    const minWidth = parseInt(features.find(f => f.startsWith('min-width'))?.split('=')[1] ?? '600', 10)
    const minHeight = parseInt(features.find(f => f.startsWith('min-height'))?.split('=')[1] ?? '600', 10)
    const man = this.activatedManifest!
    if (url.host === 'app' || detail.frameName === 'app' || (url.host.startsWith('localhost') && HAS_DEV_SERVER)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          vibrancy: man.vibrancy ? 'sidebar' : undefined, // or popover
          icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
          titleBarStyle: this.getTitlebarStyle(),
          trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
          minWidth,
          minHeight,
          width,
          height,
          show: false,
          frame: this.getFrameOption(),

          webPreferences: {
            preload: indexPreload,
            devTools: IS_DEV,
          },
        },
      }
    }

    shell.openExternal(detail.url)
    return { action: 'deny' }
  }

  private onWebContentCreateWindow = (window: BrowserWindow) => {
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

    this.handle('open-multiplayer-window', () => {
      this.openMultiplayerWindow()
    })

    this.app.on('window-all-closed', () => {
      if (process.platform !== 'darwin' && !this.parking) {
        this.app.quit()
      }
    })

    this.app.on('second-instance', () => {
      if (this.parking) {
        if (this.mainWin) {
          if (this.mainWin.isMinimized()) {
            this.mainWin.restore()
          } else if (!this.mainWin.isVisible()) {
            this.mainWin.show()
          }
          this.mainWin.focus()
        }
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

  handle(channel: string, handler: (event: { sender: Client }, ...args: any[]) => any, once = false) {
    if (!once) {
      return ipcMain.handle(channel, handler)
    }
    return ipcMain.handleOnce(channel, handler)
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
    const logger = this.app.getLogger(name, name)
    ref.webContents.on('console-message', (e, level, message, line, id) => {
      if (message.startsWith("Listener added for a synchronous 'DOMNodeRemoved' DOM Mutation Event. This event type is deprecated")) {
        return
      }
      if (level === 1) {
        logger.log(message)
      } else if (level === 2) {
        logger.warn(message)
      } else if (level === 3) {
        logger.warn(message)
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

  async startMigrate() {
    const restoredSession = this.app.session.getSession(defaultApp.url)
    const browser = new BrowserWindow({
      title: 'XMCL Launcher Migrate',
      frame: false,
      resizable: false,
      width: 600,
      height: 400,
      webPreferences: {
        preload: migrationPreload,
        session: restoredSession,
      },
    })
    browser.loadURL(migrateWinUrl)

    this.migrationRef = browser
  }

  async endMigrate(result?: { from: string; to: string }) {
    this.migrated = result
    if (this.migrationRef) {
      this.migrationRef.close()
    }
  }

  async activate(manifest: InstalledAppManifest, isBootstrap = false): Promise<void> {
    this.logger.log(`Activate app ${manifest.name} ${manifest.url}`)
    this.parking = true

    // close the old window
    if (this.mainWin && !this.mainWin.isDestroyed()) {
      this.mainWin.close()
    }

    this.activatedManifest = manifest

    try {
      await this.createAppWindow(isBootstrap)
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

  async openMultiplayerWindow() {
    if (!this.multiplayerRef || this.multiplayerRef.isDestroyed()) {
      const man = this.activatedManifest!
      const tracker = createWindowTracker(this.app, 'multiplayer', man)
      const config = await tracker.getConfig()

      const win = new BrowserWindow({
        icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
        titleBarStyle: this.getTitlebarStyle(),
        trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
        minWidth: 400,
        minHeight: 600,
        width: config.getWidth(400, 400),
        height: config.getHeight(600, 600),
        x: config.x,
        y: config.y,
        show: false,
        frame: this.getFrameOption(),

        webPreferences: {
          session: this.app.session.getSession(this.activatedManifest!.url),
          contextIsolation: true,
          sandbox: false,
          preload: multiplayerPreload,
          devTools: IS_DEV,
        },
      })

      tracker.track(win)

      const url = new URL(man.url)
      url.pathname = '/app.html'
      win.loadURL(url.toString())
      this.onWebContentCreateWindow(win)
      win.once('ready-to-show', () => {
        win.show()
      })
      win.on('close', (e) => {
        if (this.mainWin && !this.mainWin.isDestroyed()) {
          win.hide()
          e.preventDefault()
        }
      })
      this.multiplayerRef = win
    } else {
      this.multiplayerRef.show()
      this.multiplayerRef.focus()
    }
  }

  async createAppWindow(isBootstrap: boolean) {
    const man = this.activatedManifest!
    const tracker = createWindowTracker(this.app, 'app-manager', man)
    const config = await tracker.getConfig()

    const restoredSession = this.app.session.getSession(man.url)
    const minWidth = man.minWidth ?? 800
    const minHeight = man.minHeight ?? 600
    const defaultWidth = man.defaultWidth ?? 800
    const defaultHeight = man.defaultHeight ?? 600

    // Ensure the settings is loaded
    if (this.app.platform.os === 'linux' && !this.settings) {
      this.settings = await this.app.registry.get(kSettings)
    }

    const browser = new BrowserWindow({
      title: man.name,
      width: config.getWidth(defaultWidth, minWidth),
      height: config.getHeight(defaultHeight, minHeight),
      x: config.x,
      y: config.y,
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

    browser.on('ready-to-show', () => {
      this.logger.log('App Window is ready to show!')

      if (man.vibrancy) {
        this.setWindowBlurEffect(browser)
      }

      if (config.maximized) {
        browser.maximize()
      }

      if (!this.app.deferredWindowOpen) {
        browser.show()
        browser.focus()
      }
    })
    browser.webContents.on('will-navigate', this.onWebContentWillNavigate)
    browser.webContents.on('did-create-window', this.onWebContentCreateWindow)
    browser.webContents.setWindowOpenHandler(this.windowOpenHandler)
    browser.on('closed', () => {
      this.mainWin = undefined
      this.multiplayerRef?.close()
    })

    this.setupBrowserLogger(browser, 'app')
    tracker.track(browser)

    const url = new URL(man.url)
    if (isBootstrap) {
      url.searchParams.append('bootstrap', 'true')
    }
    if (this.migrated) {
      url.searchParams.append('from', this.migrated.from)
      url.searchParams.append('to', this.migrated.to)
    }
    this.logger.log(url.toString())
    browser.loadURL(url.toString())

    this.logger.log(`Load main window url ${url.toString()}`)

    this.mainWin = browser

    this.app.emit('app-booted', man)
  }

  getLoggerWindow() {
    if (this.loggerWin?.isDestroyed()) {
      this.loggerWin = undefined
    }
    return this.loggerWin
  }

  async createMonitorWindow() {
    const tracker = createWindowTracker(this.app, 'monitor', this.activatedManifest!)

    const config = await tracker.getConfig()
    const browser = new BrowserWindow({
      title: 'KeyStone Monitor',
      width: config.getWidth(600, 600),
      height: config.getHeight(400, 400),
      x: config.x,
      y: config.y,
      minWidth: 600,
      minHeight: 400,
      frame: false,
      transparent: true,
      hasShadow: false,
      maximizable: false,
      icon: darkIcon,
      webPreferences: {
        preload: monitorPreload,
        session: this.app.session.getSession(this.activatedManifest!.url),
      },
    })

    this.setupBrowserLogger(browser, 'logger')
    this.setWindowBlurEffect(browser)

    browser.loadURL(loggerWinUrl)
    browser.show()

    tracker.track(browser)

    this.loggerWin = browser
  }

  requireFocus(): void {
    if (this.mainWin) {
      if (!this.mainWin.isVisible()) {
        this.mainWin.show()
      } else {
        this.mainWin.focus()
      }
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

  getLoginSuccessHTML() {
    const title = this.i18n.t('urlSuccess')
    const body = this.i18n.t('autoCloseHint').replace('{time}', '<span id="countdown">10</span>')
    return getLoginSuccessHTML(title, body)
  }

  openDevTools() {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.closeDevTools()
        win.webContents.openDevTools({ mode: 'detach' })
      } catch {

      }
    }
  }
}
