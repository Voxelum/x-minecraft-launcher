
import { IS_DEV } from '@/constant'
import { LauncherApp, LauncherAppController } from '@xmcl/runtime'
import { InstalledAppManifest, InstanceServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'
import { BrowserWindow, dialog, session, shell, Tray } from 'electron'
import { fromFile } from 'file-type'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { acrylic } from './acrylic'
import iconPath from './assets/apple-touch-icon.png'
import './controlIpc'
import { taskProgressPlugin } from './controllers/taskProgress'
import { trayPlugin } from './controllers/tray'
import i18n from './locales'
import { trackWindowSize } from './windowSizeTracker'
import browsePreload from '/@preload/browse'
import indexPreload from '/@preload/index'
import loggerPreload from '/@preload/logger'
import setupPreload from '/@preload/setup'
import browserWinUrl from '/@renderer/browser.html'
import loggerWinUrl from '/@renderer/logger.html'
import setupWinUrl from '/@renderer/setup.html'

export default class Controller implements LauncherAppController {
  protected mainWin: BrowserWindow | undefined = undefined

  protected loggerWin: BrowserWindow | undefined = undefined

  protected setupRef: BrowserWindow | undefined = undefined

  protected browserRef: BrowserWindow | undefined = undefined

  protected i18n = i18n

  protected tray: Tray | undefined

  constructor(protected app: LauncherApp) {
    app.on('minecraft-stdout', (...args) => {
      this.app.broadcast('minecraft-stdout', ...args)
    })
    app.on('minecraft-stderr', (...args) => {
      this.app.broadcast('minecraft-stderr', ...args)
    })

    app.once('engine-ready', () => {
      app.serviceStateManager.subscribe('localeSet', (l) => {
        this.i18n.use(l)
      })
      app.serviceManager.getService(LaunchServiceKey)?.on('minecraft-window-ready', () => {
        const instance = this.app.serviceManager.getService(InstanceServiceKey)?.state.instance
        if (!instance) {
          this.app.warn('Cannot find active instance while Minecraft window ready! Perhaps something strange happed?')
          return
        }
        if (this.mainWin && this.mainWin.isVisible()) {
          this.mainWin.webContents.send('minecraft-window-ready')

          const { hideLauncher } = instance
          if (hideLauncher) {
            this.mainWin.hide()
          }
        }

        if (this.loggerWin === undefined && instance.showLog) {
          this.createLoggerWindow()
        }
      }).on('minecraft-exit', (status) => {
        const instance = this.app.serviceManager.getService(InstanceServiceKey)?.state.instance
        if (!instance) {
          this.app.warn('Cannot find active instance while Minecraft exit! Perhaps something strange happed?')
          return
        }
        const { hideLauncher } = instance
        if (hideLauncher) {
          if (this.mainWin) {
            this.mainWin.show()
          }
        }
        this.app.broadcast('minecraft-exit', status)
        if (this.loggerWin) {
          this.loggerWin.close()
          this.loggerWin = undefined
        }
      })
    })

    taskProgressPlugin.call(this)
    trayPlugin.call(this)
  }

  private setupBrowserLogger(ref: BrowserWindow, name: string) {
    const stream = this.app.logManager.openWindowLog(name)
    const levels = ['INFO', 'WARN', 'ERROR']
    ref.webContents.on('console-message', (e, level, message, line, id) => {
      stream.write(`[${levels[level]}] [${new Date().toUTCString()}] [${id}]: ${message}\n`)
    })
    ref.once('close', () => {
      ref.webContents.removeAllListeners('console-message')
      this.app.logManager.closeWindowLog(name)
    })
  }

  private setWindowAcrylic(browser: BrowserWindow) {
    const isWin = this.app.platform.name === 'windows'
    if (isWin) {
      setTimeout(() => {
        const id = browser.webContents.getOSProcessId()
        this.app.log(`Set window Acrylic transparent ${id}`)
        acrylic(id).then((e) => {
          if (e) {
            this.app.log('Set window Acrylic success')
          } else {
            this.app.warn('Set window Acrylic failed')
          }
        }, (e) => {
          this.app.warn('Set window Acrylic failed')
          this.app.warn(e)
        })
      }, 100)
    }
  }

  async bootApp(app: InstalledAppManifest): Promise<void> {
    if (this.mainWin) {
      this.mainWin.close()
    }
    await this.createAppWindow(this.app.launcherAppManager.getAppRoot(app.url), app)
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
      icon: iconPath,
      webPreferences: {
        preload: browsePreload,
      },
    })

    browser.loadURL(browserWinUrl)
    browser.on('ready-to-show', () => {
      this.setWindowAcrylic(browser)
    })

    this.browserRef = browser
  }

  async createAppWindow(appDir: string, man: InstalledAppManifest) {
    const configPath = man === this.app.getDefaultAppManifest() ? join(this.app.appDataPath, 'main-window-config.json') : join(appDir, 'window-config.json')
    this.app.log(`[Controller] Creating app window by config ${configPath}`)
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

    const sess = session.fromPartition('persist:main')

    for (const e of session.defaultSession.getAllExtensions()) {
      sess.loadExtension(e.path)
    }

    sess.webRequest.onHeadersReceived((detail, cb) => {
      if (detail.responseHeaders &&
        detail.resourceType === 'image') {
        detail.responseHeaders['Access-Control-Allow-Origin'] = ['*']
      }
      cb({ responseHeaders: detail.responseHeaders })
    })
    sess.protocol.registerFileProtocol('dataroot', (req, callback) => {
      const pathname = decodeURIComponent(req.url.replace('dataroot://', ''))
      callback(join(this.app.gameDataPath, pathname))
    })
    sess.protocol.registerFileProtocol('image', (req, callback) => {
      const pathname = decodeURIComponent(req.url.replace('image://', ''))

      fromFile(pathname).then((type) => {
        if (type && type.mime.startsWith('image/')) {
          callback(pathname)
        } else {
          callback({ statusCode: 404 })
        }
      }).catch(() => {
        callback({ statusCode: 404 })
      })
    })
    sess.protocol.registerFileProtocol('video', (req, callback) => {
      const pathname = decodeURIComponent(req.url.replace('video://', ''))
      callback(pathname)
      fromFile(pathname).then((type) => {
        if (type && type.mime.startsWith('image/')) {
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
      frame: man.frame,
      backgroundColor: man.background_color,
      vibrancy: man.vibrancy ? 'sidebar' : undefined, // or popover
      icon: man.iconPath,
      webPreferences: {
        preload: indexPreload,
        session: sess,
        webviewTag: true,
      },
    })

    if (man.ratio) {
      browser.setAspectRatio(minWidth / minHeight)
    }

    this.app.log(`[Controller] Created app window by config ${configPath}`)
    browser.on('ready-to-show', () => {
      this.app.log('App Window is ready to show!')
      if (man.vibrancy) {
        this.setWindowAcrylic(browser)
      }
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

    browser.loadURL(man.url)
    browser.show()

    this.app.log(`[Controller] Load main window url ${man.url}`)

    this.mainWin = browser

    this.app.emit('app-booted', man)
  }

  createLoggerWindow() {
    const browser = new BrowserWindow({
      title: 'KeyStone Logger',
      width: 770,
      height: 580,
      frame: false,
      transparent: true,
      hasShadow: false,
      maximizable: false,
      icon: iconPath,
      webPreferences: {
        preload: loggerPreload,
        session: session.fromPartition('persist:logger'),
      },
    })

    this.setupBrowserLogger(browser, 'logger')
    this.setWindowAcrylic(browser)

    browser.loadURL(loggerWinUrl)
    browser.show()

    this.loggerWin = browser
  }

  createSetupWindow() {
    const browser = new BrowserWindow({
      title: 'Setup XMCL',
      width: 480,
      height: 480,
      frame: false,
      transparent: true,
      hasShadow: false,
      maximizable: false,
      vibrancy: 'sidebar', // or popover
      icon: iconPath,
      webPreferences: {
        preload: setupPreload,
        session: session.fromPartition('persist:setup'),
      },
    })

    this.setupBrowserLogger(browser, 'setup')
    this.setWindowAcrylic(browser)

    browser.loadURL(setupWinUrl)
    browser.show()

    this.setupRef = browser
  }

  requireFocus(): void {
    if (this.mainWin) {
      this.mainWin.focus()
    } else if (this.loggerWin) {
      this.loggerWin.focus()
    }
  }

  async requestOpenExternalUrl(url: string) {
    const { t: $t } = this.i18n
    const result = await dialog.showMessageBox(this.mainWin!, {
      type: 'question',
      title: $t('openUrl.title', { url }),
      message: $t('openUrl.message', { url }),
      checkboxLabel: $t('openUrl.trust'),
      buttons: [$t('openUrl.cancel'), $t('openUrl.yes')],
    })
    return result.response === 1
  }

  async processFirstLaunch(): Promise<string> {
    this.app.handle('preset', () => ({ locale: this.app.getLocale(), minecraftPath: this.app.minecraftDataPath, defaultPath: this.app.appDataPath }))
    this.createSetupWindow()

    return new Promise<string>((resolve) => {
      const fallback = () => {
        resolve(this.app.appDataPath)
      }
      this.setupRef!.once('closed', fallback)

      this.setupRef!.center()
      this.setupRef!.focus()

      this.app.handle('setup', (_, s) => {
        resolve(s as string)
        this.setupRef!.removeAllListeners()
        this.setupRef!.close()
        this.setupRef = undefined
      })
    })
  }

  async dataReady(): Promise<void> {
    this.mainWin?.show()
  }

  get activeWindow() {
    return this.mainWin ?? this.loggerWin
  }
}
