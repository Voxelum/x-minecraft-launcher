import { NetworkErrorCode, NetworkException } from '@xmcl/runtime-api'
import { LauncherApp, Shell } from '@xmcl/runtime/app'
import { LAUNCHER_NAME } from '@xmcl/runtime/constant'
import { kFlights } from '@xmcl/runtime/infra'
import { AnyError } from '@xmcl/utils'
import { Menu, app, net, shell } from 'electron'
import { stat } from 'fs-extra'
import { join } from 'path'
import { fetch as ufetch } from 'undici'
import { ElectronController } from './ElectronController'
import { ElectronSecretStorage } from './ElectronSecretStorage'
import { ElectronSession } from './ElectronSession'
import { IS_DEV } from './constant'
import defaultApp from './defaultApp'
import { definedPlugins } from './definedPlugins'
import { ElectronUpdater } from './utils/updater'
import { getWindowsUtils } from './utils/windowsUtils'

class ElectronShell implements Shell {
  showItemInFolder = shell.showItemInFolder
  async openDirectory(path: string) {
    const fstat = await stat(path).catch(() => undefined)
    if (fstat?.isDirectory()) {
      return shell.openPath(path).then(r => r !== '')
    }
    return false
  }

  async openInBrowser(url: string) {
    await shell.openExternal(url)
    return true
  }

  createShortcut(path: string, details: {

    // Docs: https://electronjs.org/docs/api/structures/shortcut-details

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
  }): boolean {
    return shell.writeShortcutLink(path, details)
  }
}

const getEnv = () => {
  const isAppImage = !!process.env.APPIMAGE
  if (isAppImage) {
    return 'appimage'
  } else {
    const currentPath = app.getPath('exe')
    if (currentPath.includes('WindowsApps')) {
      return 'appx'
    } else {
      return 'raw'
    }
  }
}

function isLatin1(s: string) {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0xff) return false
  }
  return true
}

function getErrorCode(e: Error) {
  let code: NetworkErrorCode | undefined
  if (e.message === 'net::ERR_CONNECTION_CLOSED') {
    code = NetworkErrorCode.CONNECTION_CLOSED
  } else if (e.message === 'net::ERR_INTERNET_DISCONNECTED') {
    code = NetworkErrorCode.INTERNET_DISCONNECTED
  } else if (e.message === 'net::ERR_TIMED_OUT') {
    code = NetworkErrorCode.TIMED_OUT
  } else if (e.message === 'net::ERR_CONNECTION_RESET') {
    code = NetworkErrorCode.CONNECTION_RESET
  } else if (e.message === 'net::ERR_CONNECTION_TIMED_OUT') {
    code = NetworkErrorCode.CONNECTION_TIMED_OUT
  } else if (e.message === 'net::ERR_NAME_NOT_RESOLVED') {
    code = NetworkErrorCode.DNS_NOTFOUND
  } else if (e.message === 'net::NETWORK_CHANGED') {
    code = NetworkErrorCode.NETWORK_CHANGED
  } else if (e.message === 'net::PROXY_CONNECTION_FAILED') {
    code = NetworkErrorCode.PROXY_CONNECTION_FAILED
  } else if (e.message === 'net::ERR_UNEXPECTED') {
    code = NetworkErrorCode.CONNECTION_RESET
  } else if (e.message === 'net::ERR_CONNECTION_ABORTED') {
    code = NetworkErrorCode.ERR_CONNECTION_ABORTED
  }
  return code
}

export default class ElectronLauncherApp extends LauncherApp {
  readonly session: ElectronSession

  /**
   * Bug K diagnostic: when we drop a non-Latin1 header value in
   * `fetch`, we want exactly one trackException per session so the
   * source of the leak surfaces in App Insights, but we don't want a
   * trackException storm if the same caller fires on every request.
   * Track which header names we've already reported.
   */
  private readonly reportedNonLatin1Headers = new Set<string>()

  constructor() {
    // E2E hook: when XMCL_E2E_APP_DATA is set, redirect Electron's appData
    // (and therefore both `app.getPath('appData')` calls below + the one in
    // xmcl-runtime/app/LauncherApp.ts) to a per-test temporary directory.
    // This isolates every Playwright spec on a clean launcher root.
    if (process.env.XMCL_E2E_APP_DATA) {
      try {
        app.setPath('appData', process.env.XMCL_E2E_APP_DATA)
        app.setPath('userData', join(process.env.XMCL_E2E_APP_DATA, LAUNCHER_NAME))
      } catch {
        // Electron may reject if app is already ready; fall back silently.
      }
    }
    super(app as any,
      new ElectronShell(),
      new ElectronSecretStorage(join(app.getPath('appData'), LAUNCHER_NAME, IS_DEV ? 'secret-dev' : 'secret')),
      (app) => new ElectronController(app as ElectronLauncherApp),
      (app) => new ElectronUpdater(app as ElectronLauncherApp),
      defaultApp,
      getEnv(),
      definedPlugins,
    )
    this.session = new ElectronSession(this)
    // Let the `safeStorageEncryption` flight force plaintext secret storage on
    // machines where the OS keyring is broken (e.g. a faulty KWallet on KDE).
    // The flight store is populated asynchronously, so we hand the secret
    // storage a live predicate rather than a one-shot value. Default (flight
    // absent/true) keeps the auto health-probe behavior.
    if (this.secretStorage instanceof ElectronSecretStorage) {
      const secretStorage = this.secretStorage
      this.registry.get(kFlights).then((flights) => {
        secretStorage.setEncryptionDisabledProvider(() => flights.safeStorageEncryption === false)
      }).catch(() => { })
    }
    // Wayland/Ozone selection breaks Playwright's CDP page-target tracking
    // under xvfb on CI (e2e-smoke job sees zero Page targets even though the
    // BrowserWindow exists and reaches `ready-to-show`). Skip the Ozone
    // switches whenever the E2E test harness is active so Playwright stays
    // on the default X11 path.
    if (!process.env.XMCL_E2E) {
      // Enable native Wayland support with automatic platform detection
      app.commandLine?.appendSwitch('ozone-platform-hint', 'auto')
      // Enable Wayland-specific features for better native appearance
      app.commandLine?.appendSwitch('enable-features', 'UseOzonePlatform,WaylandWindowDecorations')
    }
  }

  get systemLocale(): string {
    return app.getSystemLocale()
  }

  fetch: typeof fetch = async (...args: any[]) => {
    const init = { ...args[1], bypassCustomProtocolHandlers: true }
    function assertError(e: unknown): asserts e is Error {
      if (e instanceof Error || (typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string')) {
        return
      }
      throw new TypeError(`Expected an Error, but got ${typeof e}: ${e}`)
    }
    async function handlError(e: Error, retry?: () => Promise<any>) {
      const code = getErrorCode(e)

      if (retry && (code === NetworkErrorCode.NAME_NOT_RESOLVED || code === NetworkErrorCode.CONNECTION_CLOSED || code === NetworkErrorCode.CONNECTION_RESET || !code)) {
        return await retry()
      }

      if (code) {
        // expected exceptions
        throw new NetworkException({
          type: 'networkException',
          code,
        })
      }
      // unexpected errors
      if (e.message.startsWith('net::')) {
        throw new AnyError('NetworkError', e.message)
      }

      throw e
    }
    try {
      if (init.headers && typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
        delete init.headers['origin']
        delete init.headers['sec-ch-ua']
        delete init.headers['sec-ch-ua-mobile']
        delete init.headers['sec-ch-ua-platform']
        // Headers values are Latin-1 (RFC 9110 / WHATWG ByteString).
        // Anything outside that range makes Electron's `_Headers.set`
        // throw `TypeError at webidl.converters.ByteString` ("character
        // at index N has a value of M which is greater than 255"),
        // which then surfaces in App Insights as a real exception
        // although the originating fetch call had no chance to succeed
        // anyway. Drop offending entries instead — they are virtually
        // always something like a UI display name that accidentally
        // ended up in a header.
        for (const k of Object.keys(init.headers)) {
          const v = init.headers[k]
          if (typeof v === 'string' && !isLatin1(v)) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] as URL)?.toString?.()
            const offendingIndex = [...v].findIndex((ch) => ch.charCodeAt(0) > 0xff)
            const offendingCode = v.charCodeAt(offendingIndex)
            this.logger.warn(`Dropping non-Latin1 header ${k}=${JSON.stringify(v)} (index ${offendingIndex} char ${offendingCode}) from fetch to ${url}`)
            // Bug K telemetry breadcrumb: once-per-(header name)
            // trackException with an Error carrying a real stack so
            // the upstream caller is identifiable in App Insights.
            // Cap to one report per header name per session — we
            // don't want a per-request storm if the same caller leaks
            // continuously.
            if (!this.reportedNonLatin1Headers.has(k)) {
              this.reportedNonLatin1Headers.add(k)
              const breadcrumb = new Error(
                `Non-Latin1 fetch header dropped: ${k} (value length ${v.length}, first offending char index ${offendingIndex} = 0x${offendingCode.toString(16)}); url=${url}`,
              )
              breadcrumb.name = 'NonLatin1HeaderDropped'
              this.logger.error(breadcrumb)
            }
            delete init.headers[k]
          }
        }
      }
      return await net.fetch(args[0], init) as any
    } catch (e) {
      assertError(e)
      return await handlError(e, () => ufetch(args[0], init).catch(handlError))
    }
  }

  windowsUtils = getWindowsUtils(this, this.logger)

  getAppInstallerStartUpUrl(): string {
    if (this.windowsUtils) {
      try {
        const uri = this.windowsUtils.getAppInstallerUri()
        const url = new URL(uri)
        const appUrl = url.searchParams.get('app') || ''
        return appUrl
      } catch {
        return ''
      }
    }
    return ''
  }

  relaunch(args?: string[]) {
    app.relaunch({ args })
    app.exit(0)
  }

  protected async setup() {
    // forward window-all-closed event
    app.on('window-all-closed', () => {
      this.emit('window-all-closed')
    })

    app.on('open-url', (event, url) => {
      event.preventDefault()
      this.protocol.handle({ url })
    }).on('second-instance', (e, argv) => {
      const last = argv[argv.length - 1]
      if (last.startsWith('xmcl://')) {
        this.protocol.handle({ url: last })
      } else {
        this.emit('second-instance', argv)
      }
    })

    app.whenReady().then(() => {
      Menu.setApplicationMenu(null)
    })

    await super.setup()
  }

  setProxy(url: string): void {
    this.session.setProxy(url)
  }
}
