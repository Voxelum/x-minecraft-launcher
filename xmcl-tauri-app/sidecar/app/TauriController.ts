import { InstalledAppManifest, Settings } from '@xmcl/runtime-api'
import { BaseService } from '@xmcl/runtime/app'
import type { Client, LauncherApp, LauncherAppController } from '@xmcl/runtime/app'
import type { Logger } from '@xmcl/runtime/infra'
import { kSettings } from '@xmcl/runtime/settings'
import localeMappings from '../../../assets/locales.json'
import { definedLocales } from '../../../xmcl-electron-app/main/definedLocales'
import { createI18n } from '../../../xmcl-electron-app/main/utils/i18n'
import { getLoginSuccessHTML } from '../../../xmcl-electron-app/main/utils/login'
import { TrayMenuItem, WindowSpec } from '../../bridge/shell'
import { BridgeServer } from '../bridge/BridgeServer'
import { ShellClient } from '../shell/ShellClient'
import { createWindowTracker } from './windowTracker'

const MAIN_WINDOW = 'main'
const MULTIPLAYER_WINDOW = 'multiplayer'
const MONITOR_WINDOW = 'monitor'
const MIGRATION_WINDOW = 'migration'
const LOGIN_WINDOW = 'microsoft-login'
const BROWSER_WINDOW = 'browser'

/** Tray entry ids, mapped back to actions in {@link TauriController.onTrayClick}. */
const TRAY_SHOW = 'show-launcher'
const TRAY_CHECK_UPDATE = 'check-update'
const TRAY_MULTIPLAYER = 'multiplayer'
const TRAY_SHORTCUT = 'make-desktop-shortcut'
const TRAY_RELAUNCH = 'relaunch'
const TRAY_QUIT = 'quit'
/** Emitted by the shell when the icon itself is clicked, not a menu entry. */
const TRAY_ICON_CLICK = '__click__'

/**
 * `LauncherAppController` on top of the Tauri shell.
 *
 * The split against `ElectronController` is: IPC becomes the local bridge
 * (`BridgeServer`), and every window/native operation becomes a command on the
 * shell control channel (`ShellClient`). The renderer contract is unchanged,
 * so `xmcl-keystone-ui` and the preload modules stay as they are.
 */
export class TauriController implements LauncherAppController {
  private readonly logger: Logger

  private activatedManifest: InstalledAppManifest | undefined

  private settings: Settings | undefined

  private migrated: { from: string; to: string } | undefined

  /** Windows the shell currently owns, by label. */
  private readonly opened = new Set<string>()

  /** While parking, closing every window keeps the process alive. */
  private parking = false

  private readonly i18n = createI18n(definedLocales, 'en')

  constructor(
    private readonly app: LauncherApp,
    private readonly bridge: BridgeServer,
    private readonly shell: ShellClient,
  ) {
    this.logger = app.getLogger('Controller')

    this.handle('open-multiplayer-window', () => this.openMultiplayerWindow())
    this.handle('open-monitor-window', () => this.openMonitorWindow())
    this.handle('open-browse-window', () => this.openBrowseWindow())

    this.shell.on('window-closed', (label) => {
      this.opened.delete(label)
      if (label === MAIN_WINDOW) {
        // The multiplayer window keeps `node-datachannel` sessions alive in the
        // sidecar; closing the launcher must not leave it running headless.
        this.shell.closeWindow(MULTIPLAYER_WINDOW)
      }
    })
    this.shell.on('window-all-closed', () => {
      this.logger.log(`All windows closed. parking=${this.parking}`)
      this.app.emit('window-all-closed')
      // The shell never exits on its own, so the decision Electron made in
      // `app.on('window-all-closed')` has to be taken here.
      if (this.app.platform.os !== 'osx' && !this.parking) {
        this.shell.quit()
      }
    })
    this.shell.on('second-instance', (argv) => {
      const last = argv[argv.length - 1] ?? ''
      if (last.startsWith('xmcl://')) {
        void this.app.protocol.handle({ url: last })
      } else {
        this.app.emit('second-instance', argv)
        this.requireFocus()
      }
    })
    this.shell.on('deep-link', (url) => {
      void this.app.protocol.handle({ url })
    })
    this.shell.on('tray-click', (id) => {
      void this.onTrayClick(id)
    })

    void this.setupTray()
  }

  /**
   * The tray of `xmcl-electron-app/main/controllers/tray.ts`, minus the entries
   * that only Chromium could serve (the devtools toggle and the content-tracing
   * recorder). The menu is rebuilt on every locale change because the shell has
   * no way to relabel a single entry.
   */
  private async setupTray() {
    await this.app.waitEngineReady()

    const state = await this.app.registry.get(kSettings).catch(() => undefined)
    state?.localesSet(Object.entries(localeMappings).map(([locale, name]) => ({ locale, name })))
    if (state) {
      this.i18n.use(state.locale)
      state.subscribe('config', (c) => {
        this.i18n.use(c.locale)
        this.renderTray()
      }).subscribe('localeSet', (l) => {
        this.i18n.use(l)
        this.renderTray()
      })
    }

    this.app.on('app-booted', () => this.renderTray())
    this.renderTray()
  }

  private renderTray() {
    const { t } = this.i18n
    const menu: TrayMenuItem[] = [
      { id: TRAY_SHOW, label: t('showLauncher') },
      { id: TRAY_CHECK_UPDATE, label: t('checkUpdate') },
      { id: TRAY_MULTIPLAYER, label: t('multiplayer') },
      { id: TRAY_SHORTCUT, label: t('makeDesktopShortcut') },
      { id: TRAY_RELAUNCH, label: t('relaunch') },
      { id: TRAY_QUIT, label: t('quit') },
    ]
    const icons = (this.activatedManifest ?? this.app.builtinAppManifest).iconSets
    this.shell.setTray({
      tooltip: t('title'),
      icon: icons.trayIcon,
      menu,
    })
  }

  private async onTrayClick(id: string) {
    switch (id) {
      case TRAY_ICON_CLICK:
      case TRAY_SHOW:
        this.requireFocus()
        break
      case TRAY_CHECK_UPDATE: {
        const service = await this.app.registry.get(BaseService)
        await service.checkUpdate()
        break
      }
      case TRAY_MULTIPLAYER:
        await this.openMultiplayerWindow()
        break
      case TRAY_SHORTCUT: {
        const service = await this.app.registry.get(BaseService)
        service.makeDesktopShortcut()
        break
      }
      case TRAY_RELAUNCH:
        this.shell.relaunch()
        break
      case TRAY_QUIT:
        this.shell.quit()
        break
    }
  }

  handle(channel: string, handler: (event: { sender: Client }, ...args: any[]) => any, once = false) {
    if (once) {
      this.bridge.handleOnce(channel, handler)
    } else {
      this.bridge.handle(channel, handler)
    }
  }

  broadcast(channel: string, ...payload: any[]): void {
    this.bridge.broadcast(channel, ...payload)
  }

  async activate(manifest: InstalledAppManifest, isBootstrap = false): Promise<void> {
    this.logger.log(`Activate app ${manifest.name} ${manifest.url}`)
    if (this.activatedManifest && this.activatedManifest.url !== manifest.url) {
      this.shell.closeWindow(MAIN_WINDOW)
    }
    this.parking = true
    this.activatedManifest = manifest

    const url = new URL(manifest.url)
    if (isBootstrap) {
      url.searchParams.append('bootstrap', 'true')
    }
    if (this.migrated) {
      url.searchParams.append('from', this.migrated.from)
      url.searchParams.append('to', this.migrated.to)
    }

    const tracker = createWindowTracker(this.app, 'app-manager', manifest)
    const config = await tracker.getConfig()
    const minWidth = manifest.minWidth ?? 800
    const minHeight = manifest.minHeight ?? 600

    this.openWindow({
      label: MAIN_WINDOW,
      url: url.toString(),
      title: manifest.name,
      width: config.getWidth(manifest.defaultWidth ?? 800, minWidth),
      height: config.getHeight(manifest.defaultHeight ?? 600, minHeight),
      minWidth,
      minHeight,
      x: config.x ?? undefined,
      y: config.y ?? undefined,
      maximized: config.maximized,
      decorations: await this.useSystemTitlebar(),
      backgroundColor: manifest.backgroundColor,
    })
    this.parking = false

    this.app.emit('app-booted', manifest)
  }

  /**
   * The multiplayer UI keeps running in its own window like it did in Electron,
   * but the WebRTC session itself now lives in the sidecar: WebKitGTK ships no
   * `RTCPeerConnection` on Linux, so the peer runs on `node-datachannel` and
   * this window only drives it through the bridge.
   */
  async openMultiplayerWindow() {
    if (this.opened.has(MULTIPLAYER_WINDOW)) {
      this.shell.showWindow(MULTIPLAYER_WINDOW)
      this.shell.focusWindow(MULTIPLAYER_WINDOW)
      return
    }
    const man = this.activatedManifest
    if (!man) return
    const tracker = createWindowTracker(this.app, 'multiplayer', man)
    const config = await tracker.getConfig()
    const url = new URL(man.url)
    url.pathname = '/app.html'

    this.openWindow({
      label: MULTIPLAYER_WINDOW,
      url: url.toString(),
      title: 'XMCL Multiplayer',
      width: config.getWidth(400, 400),
      height: config.getHeight(600, 600),
      minWidth: 400,
      minHeight: 600,
      x: config.x ?? undefined,
      y: config.y ?? undefined,
      decorations: await this.useSystemTitlebar(),
      hideOnClose: true,
    })
  }

  async openMonitorWindow() {
    const man = this.activatedManifest
    if (!man) return
    if (this.opened.has(MONITOR_WINDOW)) {
      this.shell.showWindow(MONITOR_WINDOW)
      return
    }
    const tracker = createWindowTracker(this.app, 'monitor', man)
    const config = await tracker.getConfig()
    const url = new URL(man.url)
    url.pathname = '/logger.html'

    this.openWindow({
      label: MONITOR_WINDOW,
      url: url.toString(),
      title: 'KeyStone Monitor',
      width: config.getWidth(600, 600),
      height: config.getHeight(400, 400),
      minWidth: 600,
      minHeight: 400,
      x: config.x ?? undefined,
      y: config.y ?? undefined,
      decorations: false,
      transparent: true,
      resizable: false,
    })
  }

  /**
   * The app browser (`browser.html`), the only window that gets `appsHost`. It
   * is the counterpart of `ElectronController.createBrowseWindow`, so the same
   * frameless 860x450 window, loaded with the `browse` bridge instead of the
   * launcher one.
   */
  async openBrowseWindow() {
    if (this.opened.has(BROWSER_WINDOW)) {
      this.shell.showWindow(BROWSER_WINDOW)
      this.shell.focusWindow(BROWSER_WINDOW)
      return
    }
    const url = new URL(this.activatedManifest?.url ?? this.app.builtinAppManifest.url)
    url.pathname = '/browser.html'

    this.openWindow({
      label: BROWSER_WINDOW,
      url: url.toString(),
      title: 'XMCL Launcher Browser',
      width: 860,
      height: 450,
      decorations: false,
      transparent: true,
      resizable: false,
      preload: 'browse',
    })
  }

  startMigrate(): void {
    const url = new URL(this.activatedManifest?.url ?? this.app.builtinAppManifest.url)
    url.pathname = '/migration.html'
    this.openWindow({
      label: MIGRATION_WINDOW,
      url: url.toString(),
      title: 'XMCL Launcher Migrate',
      width: 600,
      height: 400,
      decorations: false,
      resizable: false,
    })
  }

  endMigrate(result?: { from: string; to: string }): void {
    this.migrated = result
    if (this.opened.has(MIGRATION_WINDOW)) {
      this.shell.closeWindow(MIGRATION_WINDOW)
      this.opened.delete(MIGRATION_WINDOW)
    }
  }

  requireFocus(): void {
    if (!this.opened.has(MAIN_WINDOW)) {
      // Nothing to focus: the launcher window was closed while the runtime kept
      // working (a game running, a task in flight), so bring it back.
      const manifest = this.activatedManifest
      if (manifest) {
        void this.activate(manifest)
      }
      return
    }
    this.shell.showWindow(MAIN_WINDOW)
    this.shell.focusWindow(MAIN_WINDOW)
  }

  /**
   * Electron ran this flow in a modal `BrowserWindow` and read the code from
   * `will-navigate`. Here the window is a plain wry webview without the bridge,
   * and the shell cancels the navigation to the redirect URI and reports it.
   */
  openMicrosoftLogin(authorizationUrl: string, redirectUri: string, signal?: AbortSignal): Promise<string> {
    const redirect = new URL(redirectUri)
    return new Promise<string>((resolve, reject) => {
      let settled = false
      const finish = (error?: Error, code?: string) => {
        if (settled) return
        settled = true
        this.shell.off('navigate', onNavigate)
        this.shell.off('window-closed', onClosed)
        signal?.removeEventListener('abort', onAbort)
        if (this.opened.has(LOGIN_WINDOW)) {
          this.shell.closeWindow(LOGIN_WINDOW)
        }
        if (error) reject(error)
        else resolve(code!)
      }
      const onNavigate = (label: string, url: string) => {
        if (label !== LOGIN_WINDOW) return
        const target = new URL(url)
        const error = target.searchParams.get('error')
        if (error) {
          finish(new Error(target.searchParams.get('error_description') || error))
          return
        }
        const code = target.searchParams.get('code')
        finish(code ? undefined : new Error('Microsoft authorization returned no code.'), code ?? undefined)
      }
      const onClosed = (label: string) => {
        if (label !== LOGIN_WINDOW) return
        finish(new Error('Microsoft authorization window was closed.'))
      }
      const onAbort = () => {
        const error = new Error('Microsoft authorization was cancelled.')
        error.name = 'AbortError'
        finish(error)
      }

      this.shell.on('navigate', onNavigate)
      this.shell.on('window-closed', onClosed)
      signal?.addEventListener('abort', onAbort, { once: true })

      this.openWindow({
        label: LOGIN_WINDOW,
        url: authorizationUrl,
        title: 'Sign in to Microsoft',
        width: 560,
        height: 720,
        minWidth: 420,
        minHeight: 600,
        decorations: true,
        navigateIntercept: redirect.origin + redirect.pathname,
        preload: 'none',
      })
    })
  }

  getLoginSuccessHTML(): string {
    return getLoginSuccessHTML('Login Success')
  }

  private openWindow(spec: WindowSpec) {
    this.opened.add(spec.label)
    this.shell.openWindow(spec)
  }

  /**
   * Electron only removed the system titlebar on Linux when the user asked for
   * it (`linuxTitlebar`); the UI draws its own otherwise.
   */
  private async useSystemTitlebar() {
    if (!this.settings) {
      this.settings = await this.app.registry.get(kSettings).catch(() => undefined)
    }
    if (this.app.platform.os !== 'linux') return true
    return !!this.settings?.linuxTitlebar
  }
}
