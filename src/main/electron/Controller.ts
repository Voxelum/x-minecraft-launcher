
import { LauncherAppController } from '/@main/app/LauncherAppController'
import { IS_DEV } from '/@main/constant'
import BaseService from '../services/BaseService'
import { acrylic } from '/@main/util/acrylic'
import { trackWindowSize } from '/@main/util/windowSizeTracker'
import { TaskNotification } from '/@shared/entities/notification'
import { StaticStore } from '../util/staticStore'
import { app, BrowserWindow, dialog, ProcessMemoryInfo, Menu, session, Tray, Notification, net, shell } from 'electron'
import { readFile, readJSON } from 'fs-extra'
import { join, resolve } from 'path'
import indexPreload from '/@preload/index'
import mainWinUrl from '/@renderer/index.html'
import loggerWinUrl from '/@renderer/logger.html'
import setupWinUrl from '/@renderer/setup.html'
import LauncherApp from '../app/LauncherApp'
import favcon2XPath from '/@static/favicon@2x.png'
import iconPath from '/@static/apple-touch-icon.png'
import i18n from './locales'
import { fileType } from '../util/fs'
import { fromFile } from 'file-type'

export default class Controller implements LauncherAppController {
  private mainWin: BrowserWindow | undefined = undefined

  private loggerWin: BrowserWindow | undefined = undefined

  private setupRef: BrowserWindow | undefined = undefined

  private i18n = i18n

  private tray: Tray | undefined

  private store!: StaticStore<any>

  constructor(protected app: LauncherApp) { }

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

  private setWindowArcry(browser: BrowserWindow) {
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

  async createMainWindow() {
    const configPath = join(this.app.appDataPath, 'main-window-config.json')
    this.app.log(`[Controller] Creating main window by config ${configPath}`)
    const configData = await readJSON(configPath).catch(() => ({
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
      console.log(pathname)
      callback(pathname)
      // fromFile(pathname).then((type) => {
      //   if (type && type.mime.startsWith('image/')) {
      //     callback(pathname)
      //   } else {
      //     callback({ statusCode: 404 })
      //   }
      // }).catch(() => {
      //   callback({ statusCode: 404 })
      // })
    })

    const browser = new BrowserWindow({
      title: 'KeyStone Launcher',
      minWidth: 800,
      minHeight: 580,
      maxWidth: 1200,
      maxHeight: 870,
      width: config.width > 0 ? config.width : undefined,
      height: config.height > 0 ? config.height : undefined,
      // x: config.x !== null ? config.x : undefined,
      // y: config.x !== null ? config.x : undefined,
      resizable: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      maximizable: false,
      vibrancy: 'sidebar', // or popover
      icon: iconPath,
      webPreferences: {
        // webSecurity: !IS_DEV, // disable security for loading local image
        nodeIntegration: IS_DEV, // enable node for webpack in dev
        preload: indexPreload,
        session: sess,
        webviewTag: true,
      },
    })

    this.app.log(`[Controller] Created main window by config ${configPath}`)
    browser.on('ready-to-show', () => { this.app.log('Main Window is ready to show!') })
    browser.on('close', () => { })
    browser.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      if (!IS_DEV) {
          shell.openExternal(url);
      } else if (!url.startsWith('http://localhost')) {
          shell.openExternal(url);
      }
  });

    this.setupBrowserLogger(browser, 'main')
    this.setWindowArcry(browser)

    trackWindowSize(browser, config, configPath)

    browser.loadURL(mainWinUrl)
    browser.show()

    this.app.log(`[Controller] Load main window url ${mainWinUrl}`)

    this.mainWin = browser
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
        // webSecurity: !IS_DEV, // disable security for loading local image
        nodeIntegration: IS_DEV, // enable node for webpack in dev
        preload: indexPreload,
        session: session.fromPartition('persist:logger'),
      },
    })

    this.setupBrowserLogger(browser, 'logger')
    this.setWindowArcry(browser)

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
        // webSecurity: !IS_DEV, // disable security for loading local image
        nodeIntegration: IS_DEV, // enable node for webpack in dev
        preload: indexPreload,
        session: session.fromPartition('persist:setup'),
      },
    })

    this.setupBrowserLogger(browser, 'setup')
    this.setWindowArcry(browser)

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

  private createMenu() {
    const { t: $t } = this.i18n
    const app = this.app
    const service = this.app.getRegisteredObject(BaseService)
    return Menu.buildFromTemplate([
      {
        type: 'normal',
        label: $t('checkUpdate'),
        click() {
          service?.checkUpdate()
        },
      },
      { type: 'separator' },
      {
        label: $t('showDiagnosis'),
        type: 'normal',
        click() {
          const cpu = process.getCPUUsage()
          const mem = process.getProcessMemoryInfo()

          const p: Promise<ProcessMemoryInfo> = mem instanceof Promise ? mem : Promise.resolve(mem)
          p.then((m) => {
            const cpuPercentage = (cpu.percentCPUUsage * 100).toFixed(2)
            const messages = [
              `Mode: ${process.env.NODE_ENV}`,
              `CPU: ${cpuPercentage}%`,
              `Private Memory: ${m.private}KB`,
              `Shared Memory: ${m.shared}KB`,
              `Physically Memory: ${m.residentSet}KB`,
            ]
            dialog.showMessageBox({
              type: 'info',
              title: 'Diagnosis Info',
              message: `${messages.join('\n')}`,
            })
          })
        },
      },
      { type: 'separator' },
      {
        label: $t('quit'),
        type: 'normal',
        click() {
          app.quit()
        },
      },
    ])
  }

  private setupTray() {
    const tray = new Tray(favcon2XPath)
    tray.on('click', () => {
      const window = this.mainWin
      if (window && !window.isFocused()) {
        window.focus()
      }
    }).on('double-click', () => {
      const window = this.mainWin
      if (window) {
        if (window.isVisible()) window.hide()
        else window.show()
      }
    })
    if (app.dock) {
      app.dock.setIcon(iconPath)
    }
    this.tray = tray
  }

  onMinecraftWindowReady() {
    const { getters } = this.store
    if (this.mainWin && this.mainWin.isVisible()) {
      this.mainWin.webContents.send('minecraft-window-ready')

      const { hideLauncher } = getters.instance
      if (hideLauncher) {
        this.mainWin.hide()
      }
    }

    if (this.loggerWin === undefined && getters.instance.showLog) {
      this.createLoggerWindow()
    }
  }

  onMinecraftExited(status: any) {
    const { hideLauncher } = this.store.getters.instance
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
  }

  async processFirstLaunch(): Promise<string> {
    this.createSetupWindow()
    this.app.handle('preset', () => ({ locale: this.app.getLocale(), minecraftPath: this.app.minecraftDataPath, defaultPath: this.app.appDataPath }))

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

  async engineReady() {
    await this.createMainWindow()
    this.setupTray()
    this.setupTask()

    this.app.on('minecraft-stdout', (...args) => {
      this.app.broadcast('minecraft-stdout', ...args)
    })
    this.app.on('minecraft-stderr', (...args) => {
      this.app.broadcast('minecraft-stderr', ...args)
    })

    this.app
      .on('minecraft-window-ready', this.onMinecraftWindowReady.bind(this))
      .on('minecraft-exit', this.onMinecraftExited.bind(this))
  }

  async dataReady(store: StaticStore<any>): Promise<void> {
    this.mainWin!.show()
    this.store = store
    this.store.commit('locales', this.i18n.locales)
    this.store.subscribe((mutation) => {
      if (mutation.type === 'locale') {
        this.i18n.use(mutation.payload)
      }
    })
    this.i18n.use(this.store.state.base.locale)

    const $t = this.i18n.t
    const tray = this.tray
    if (tray) {
      tray.setContextMenu(this.createMenu())
      store.subscribe((m) => {
        if (m.type === 'locale') {
          tray.setToolTip($t('title'))
          tray.setContextMenu(this.createMenu())
        }
      })
    }
  }

  get activeWindow() {
    return this.mainWin ?? this.loggerWin
  }

  private setupTask() {
    const tasks = this.app.taskManager
    tasks.emitter.on('update', (uid, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          this.activeWindow.setProgressBar(task.progress / task.total)
        }
      }
    })
    tasks.emitter.on('success', (_, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          this.activeWindow.setProgressBar(-1)
        }
        this.notify({ type: 'taskFinish', name: task.path, arguments: task.param })
      }
    })
    tasks.emitter.on('fail', (_, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          this.activeWindow.setProgressBar(-1)
        }
        this.notify({ type: 'taskFail', name: task.path, arguments: task.param })
      }
    })
  }

  private notify(n: TaskNotification) {
    const $t = this.i18n.t
    if (this.activeWindow && this.activeWindow.isFocused()) {
      this.activeWindow.webContents.send('notification', n)
    } else if ((n.type === 'taskFinish' || n.type === 'taskFail')) {
      const notification = new Notification({
        title: n.type === 'taskFinish' ? $t('task.success') : $t('task.fail'),
        body: $t('task.continue'),
        icon: iconPath,
      })
      notification.show()
      notification.on('click', () => {
        if (this.activeWindow?.isVisible()) {
          this.activeWindow.focus()
        } else {
          // eslint-disable-next-line no-unused-expressions
          this.activeWindow?.show()
        }
      })
    } else {
      this.app.broadcast('notification', n)
    }
  }
}
