
import { AccentState, IS_DEV, WindowsBuild } from '@/constant'
import browsePreload from '@preload/browse'
import indexPreload from '@preload/index'
import monitorPreload from '@preload/monitor'
import browserWinUrl from '@renderer/browser.html'
import loggerWinUrl from '@renderer/logger.html'
import { LauncherAppController } from '@xmcl/runtime'
import { InstalledAppManifest } from '@xmcl/runtime-api'
import { Logger } from '@xmcl/runtime/lib/util/log'
import { BrowserWindow, dialog, ipcMain, nativeTheme, session, shell, Tray } from 'electron'
import { fromFile } from 'file-type'
import { createReadStream, readFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { isAbsolute, join } from 'path'
import { plugins } from './controllers'
import ElectronLauncherApp from './ElectronLauncherApp'
import en from './locales/en.yaml'
import ru from './locales/ru.yaml'
import zh from './locales/zh-CN.yaml'
import { builtinIcons } from './utils/builtinIcons'
import { createI18n } from './utils/i18n'
import { darkIcon } from './utils/icons'
import { trackWindowSize } from './utils/windowSizeTracker'

export default class Controller implements LauncherAppController {
  protected windowsVersion?: { major: number; minor: number; build: number }

  protected mainWin: BrowserWindow | undefined = undefined

  protected loggerWin: BrowserWindow | undefined = undefined

  protected browserRef: BrowserWindow | undefined = undefined

  protected i18n = createI18n({ en, 'zh-CN': zh, ru }, 'en')

  private logger: Logger

  protected tray: Tray | undefined

  /**
   * During the app is parking, even if the all windows are closed, the app will keep open.
   */
  protected parking = false

  constructor(protected app: ElectronLauncherApp) {
    plugins.forEach(p => p.call(this))

    if (app.platform.name === 'windows') {
      this.windowsVersion = app.windowsUtils?.getWindowsVersion()
    }

    this.app.on('window-all-closed', () => {
      if (process.platform !== 'darwin' && !this.parking) {
        this.app.quit()
      }
    })

    this.logger = this.app.logManager.getLogger('Controller')
  }

  setupBrowserLogger(ref: BrowserWindow, name: string) {
    const stream = this.app.logManager.openWindowLog(name)
    const levels = ['', 'INFO', 'WARN', 'ERROR']
    ref.webContents.on('console-message', (e, level, message, line, id) => {
      stream.write(`[${levels[level]}] [${new Date().toUTCString()}] [${id}]: ${message}\n`)
    })
    ref.once('close', () => {
      ref.webContents.removeAllListeners('console-message')
      this.app.logManager.closeWindowLog(name)
    })
  }

  private setWindowBlurEffect(browser: BrowserWindow) {
    const isWin = this.app.platform.name === 'windows'
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

  async activate(app: InstalledAppManifest): Promise<void> {
    this.logger.log(`Activate app ${app.name} ${app.url}`)
    this.parking = true

    // close the old window
    if (this.mainWin) {
      this.mainWin.close()
    }

    try {
      await this.createAppWindow(this.app.launcherAppManager.getAppRoot(app.url), app)
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

  async createAppWindow(appDir: string, man: InstalledAppManifest) {
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

    const restoredSession = session.fromPartition('persist:main')

    for (const e of session.defaultSession.getAllExtensions()) {
      restoredSession.loadExtension(e.path)
    }

    restoredSession.webRequest.onHeadersReceived((detail, cb) => {
      if (detail.responseHeaders &&
        detail.resourceType === 'image') {
        detail.responseHeaders['Access-Control-Allow-Origin'] = ['*']
      }
      cb({ responseHeaders: detail.responseHeaders })
    })
    restoredSession.protocol.registerFileProtocol('image', (req, callback) => {
      const pathname = decodeURIComponent(req.url.replace('image://', ''))

      if (pathname.startsWith('image:builtin:')) {
        const name = pathname.substring('image:builtin:'.length)
        if (builtinIcons[name]) {
          // const data = createReadStream(builtinIcons[name])
          callback({ path: builtinIcons[name] })
        } else {
          callback({ statusCode: 404 })
        }
      } else if (isAbsolute(pathname)) {
        fromFile(pathname).then((type) => {
          if (type && type.mime.startsWith('image/')) {
            callback(pathname)
          } else {
            callback({ statusCode: 404 })
          }
        }).catch(() => {
          callback({ statusCode: 404 })
        })
      } else if (pathname.length === 40) {
        callback({ path: join(this.app.appDataPath, 'resource-images', pathname), mimeType: 'image/png' })
      } else {
        callback({ statusCode: 404 })
      }
    })
    restoredSession.protocol.registerFileProtocol('video', (req, callback) => {
      const pathname = decodeURIComponent(req.url.replace('video://', ''))
      fromFile(pathname).then((type) => {
        if (type && type.mime.startsWith('video/')) {
          callback(pathname)
        } else {
          callback({ statusCode: 404 })
        }
      }).catch(() => {
        callback({ statusCode: 404 })
      })
    })

    const minWidth = man.minWidth ?? 800
    const minHeight = man.minHeight ?? 600

    const browser = new BrowserWindow({
      title: man.name,
      width: config.width > 0 ? config.width : undefined,
      height: config.height > 0 ? config.height : undefined,
      minWidth: man.minWidth,
      minHeight: man.minHeight,
      frame: false,
      backgroundColor: man.backgroundColor,
      vibrancy: man.vibrancy ? 'sidebar' : undefined, // or popover
      icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
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
    browser.on('close', () => { })
    browser.webContents.on('will-navigate', (event, url) => {
      event.preventDefault()
      if (!IS_DEV) {
        shell.openExternal(url)
      } else if (!url.startsWith('http://localhost')) {
        shell.openExternal(url)
      }
    })

    this.setupBrowserLogger(browser, 'app')

    trackWindowSize(browser, config, configPath)

    let url = man.url
    if (await this.app.gamePathMissingSignal.promise) {
      url += '?setup'
    }
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

  get activeWindow() {
    return this.mainWin ?? this.loggerWin
  }
}
