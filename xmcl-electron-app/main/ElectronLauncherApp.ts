import { NetworkErrorCode, NetworkException } from '@xmcl/runtime-api'
import { LauncherApp, Shell } from '@xmcl/runtime/app'
import { LAUNCHER_NAME } from '@xmcl/runtime/constant'
import { Menu, app, net, shell } from 'electron'
import { fetch as ufetch } from 'undici'
import { stat } from 'fs-extra'
import { isAbsolute, join } from 'path'
import { AnyError } from '~/util/error'
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
    // TODO: make sure this
    // if (details.target === app.getPath('exe') && this.env === 'appx') {
    //   details.target = 'C:\\Windows\\Explorer.exe'
    //   details.args = `shell:AppsFolder\\${getPackageFamilyName()}!App ${details.args}`
    // }
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

  constructor() {
    super(app,
      new ElectronShell(),
      new ElectronSecretStorage(join(app.getPath('appData'), LAUNCHER_NAME, IS_DEV ? 'secret-dev' : 'secret')),
      (app) => new ElectronController(app as ElectronLauncherApp),
      (app) => new ElectronUpdater(app as ElectronLauncherApp),
      defaultApp,
      getEnv(),
      definedPlugins,
    )
    this.session = new ElectronSession(this)
    app.commandLine?.appendSwitch('ozone-platform-hint', 'auto')
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

      if (retry && (code === NetworkErrorCode.CONNECTION_CLOSED || code === NetworkErrorCode.CONNECTION_RESET || !code)) {
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
