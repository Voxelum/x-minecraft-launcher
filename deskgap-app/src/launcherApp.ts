import type { InstalledAppManifest } from '@xmcl/runtime-api'
import { BaseService, LauncherApp, type SecretStorage, type Shell } from '@xmcl/runtime/app'
import { LAUNCHER_NAME } from '@xmcl/runtime/constant'
import { kSettings } from '@xmcl/runtime/settings'
import { app, credentials, Menu, nativeTheme, session, shell, Tray } from 'deskgap'
import { mkdirSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import darkIco from '../../xmcl-electron-app/icons/dark.ico'
import darkIcon from '../../xmcl-electron-app/icons/dark@256x256.png'
import darkTray from '../../xmcl-electron-app/icons/dark@tray.png'
import lightIco from '../../xmcl-electron-app/icons/light.ico'
import lightIcon from '../../xmcl-electron-app/icons/light@256x256.png'
import lightTray from '../../xmcl-electron-app/icons/light@tray.png'
import { definedLocales } from '../../xmcl-electron-app/main/definedLocales'
import { createI18n } from '../../xmcl-electron-app/main/utils/i18n'
import { DeskGapController } from './controller'
import { plugins } from './plugins'
import { toWebResponseBody } from './transport'
import { DeskGapUpdater } from './updater'
import { createDeskGapUpdater } from './updaterHost'

const manifest = {
  name: 'X Minecraft Launcher',
  description: 'The default XMCL interface hosted by DeskGap',
  url: 'xmcl-deskgap://launcher/index.html',
  backgroundColor: '0x424242',
  minWidth: 800,
  minHeight: 400,
  defaultWidth: 1200,
  defaultHeight: 720,
  vibrancy: false,
  ratio: false,
  screenshots: [],
  iconSets: {
    icon: process.platform === 'win32' ? lightIco : lightIcon,
    darkIcon: process.platform === 'win32' ? darkIco : darkIcon,
    trayIcon: lightTray,
    darkTrayIcon: darkTray,
    dockIcon: lightIcon,
    darkDockIcon: darkIcon,
  },
  iconUrls: { icon: '', darkIcon: '', trayIcon: '', darkTrayIcon: '', dockIcon: '', darkDockIcon: '' },
}

class DeskGapShell implements Shell {
  showItemInFolder(path: string) {
    shell.showItemInFolder(path)
  }

  async openDirectory(path: string) {
    if (!(await stat(path).catch(() => undefined))?.isDirectory()) return false
    return await shell.openPath(path) === ''
  }

  async openInBrowser(url: string) {
    await shell.openExternal(url)
    return true
  }

  createShortcut(path: string, details: Record<string, unknown>) {
    return shell.writeShortcutLink(path, 'replace', details)
  }
}

class DeskGapSecretStorage implements SecretStorage {
  async get(service: string, account: string) {
    return await credentials.getPassword(service, account) ?? undefined
  }

  put(service: string, account: string, value: string) {
    return credentials.setPassword(service, account, value)
  }
}

const host = {
  ...app,
  isDefaultProtocolClient: app.isDefaultProtocolClient.bind(app),
  setAsDefaultProtocolClient: app.setAsDefaultProtocolClient.bind(app),
  requestSingleInstanceLock: app.requestSingleInstanceLock.bind(app),
  getVersion: () => app.getVersion() ?? '0.0.0',
  getLocale: app.getLocale.bind(app),
  getLocaleCountryCode: () => app.getSystemLocale().split('-')[1] ?? '',
  quit: app.quit.bind(app),
  exit: app.exit.bind(app),
  getPath(key: string) {
    if (key === 'module') return dirname(process.execPath)
    if (key === 'recent') return app.getPath('documents')
    if (key === 'crashDumps') return app.getPath('logs')
    return app.getPath(key)
  },
  whenReady: app.whenReady.bind(app),
  relaunch: app.relaunch.bind(app),
  getGPUInfo: async () => ({}),
}

export class DeskGapLauncherApp extends LauncherApp {
  readonly browserSession = session.fromPartition('persist:main')
  private readonly networkSession = session.fromName('xmcl-network')
  private tray?: Tray
  private activeManifest: InstalledAppManifest = manifest
  private readonly i18n = createI18n(definedLocales, 'en')

  constructor() {
    if (process.env.XMCL_E2E_APP_DATA) {
      app.setPath('appData', process.env.XMCL_E2E_APP_DATA)
      app.setPath('userData', join(process.env.XMCL_E2E_APP_DATA, LAUNCHER_NAME))
    }
    mkdirSync(join(app.getPath('appData'), LAUNCHER_NAME), { recursive: true })
    super(
      host as any,
      new DeskGapShell(),
      new DeskGapSecretStorage(),
      launcher => new DeskGapController(launcher as DeskGapLauncherApp),
      createDeskGapUpdater,
      manifest,
      'raw',
      plugins,
    )
    this.browserSession.setUserAgent(this.userAgent)
    this.networkSession.setUserAgent(this.userAgent)
    this.setupTray()
    this.browserSession.protocol.handle('xmcl-resource', async (request, context) => {
      const url = new URL(request.url)
      const response = await this.protocol.handle({
        method: request.method,
        url: new URL(`http://launcher${url.pathname}${url.search}`),
        headers: Object.fromEntries(request.headers.entries()),
        signal: context.signal,
      })
      return new Response(toWebResponseBody(response.body), {
        status: response.status,
        headers: { ...response.headers, 'access-control-allow-origin': '*' },
      })
    })
  }

  fetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    this.networkSession.fetch(typeof input === 'string' || input instanceof URL ? input : input.url, init)

  setProxy(url: string) {
    void this.networkSession.setProxy(url ? { proxyRules: url } : { mode: 'system' })
  }

  override async quit() {
    if (this.updater instanceof DeskGapUpdater && (await this.registry.get(kSettings)).autoInstallOnAppQuit) {
      await this.updater.installOnQuit()
    }
    await super.quit()
  }

  getWindowIcon(appManifest: InstalledAppManifest) {
    return nativeTheme.shouldUseDarkColors
      ? appManifest.iconSets.darkIcon || appManifest.iconSets.icon
      : appManifest.iconSets.icon || appManifest.iconSets.darkIcon
  }

  private getTrayIcon(appManifest: InstalledAppManifest) {
    return nativeTheme.shouldUseDarkColors
      ? appManifest.iconSets.darkTrayIcon || appManifest.iconSets.trayIcon
      : appManifest.iconSets.trayIcon || appManifest.iconSets.darkTrayIcon
  }

  private setupTray() {
    const createMenu = () => {
      const { t } = this.i18n
      return Menu.buildFromTemplate([
        { label: t('showLauncher'), click: () => this.controller.requireFocus() },
        { type: 'separator' },
        {
          label: t('checkUpdate'),
          click: () => { void this.registry.get(BaseService).then(service => service.checkUpdate()) },
        },
        {
          label: t('multiplayer'),
          click: () => (this.controller as DeskGapController).navigate('/multiplayer'),
        },
        {
          label: t('makeDesktopShortcut'),
          click: () => { void this.registry.get(BaseService).then(service => service.makeDesktopShortcut()) },
        },
        { type: 'separator' },
        {
          label: t('relaunch'),
          click: () => {
            this.relaunch()
            void this.quit()
          },
        },
        { label: t('quit'), click: () => { void this.quit() } },
      ])
    }
    const refreshTray = () => {
      this.tray?.setImage(this.getTrayIcon(this.activeManifest))
      this.tray?.setToolTip(this.i18n.t('title'))
      this.tray?.setContextMenu(createMenu())
      ;(this.controller as DeskGapController).updateWindowIcon(this.activeManifest)
    }
    const onThemeUpdated = () => refreshTray()
    nativeTheme.on('updated', onThemeUpdated)
    this.on('app-booted', (appManifest: InstalledAppManifest) => {
      this.activeManifest = appManifest
      refreshTray()
    })
    void this.registry.get(kSettings).then((settings) => {
      const updateLocale = (locale: string) => {
        this.i18n.use(locale)
        refreshTray()
      }
      updateLocale(settings.locale)
      settings.subscribe('config', config => updateLocale(config.locale))
        .subscribe('localeSet', updateLocale)
    })
    void this.waitEngineReady().then(() => {
      if (this.disposed || this.tray) return
      const tray = new Tray(this.getTrayIcon(this.activeManifest))
      this.tray = tray
      tray.on('click', () => this.controller.requireFocus())
      tray.on('double-click', () => this.controller.requireFocus())
      refreshTray()
    })
    this.registryDisposer(() => {
      nativeTheme.removeListener('updated', onThemeUpdated)
      this.tray?.destroy()
      this.tray = undefined
    })
  }

  protected async setup() {
    app.on('window-all-closed', () => this.emit('window-all-closed'))
    app.on('open-url', (event: unknown, url: string) => { void this.protocol.handle({ url }) })
    app.on('second-instance', (_event: unknown, argv: string[]) => {
      const url = argv.find(value => value.startsWith('xmcl://'))
      if (url) void this.protocol.handle({ url })
      else this.emit('second-instance', argv)
    })
    await app.whenReady()
    Menu.setApplicationMenu(null)
    await super.setup()
  }
}