import { LauncherApp, Shell } from '@xmcl/runtime/app'
import { LAUNCHER_NAME } from '@xmcl/runtime/constant'
import { Menu, app, net, shell } from 'electron'
import { join } from 'path'
import { ElectronController } from './ElectronController'
import { ElectronSecretStorage } from './ElectronSecretStorage'
import { IS_DEV } from './constant'
import defaultApp from './defaultApp'
import { definedPlugins } from './definedPlugins'
import { ElectronUpdater } from './utils/updater'
import { getWindowsUtils } from './utils/windowsUtils'
import { ElectronSession } from './ElectronSession'
import { stat } from 'fs-extra'

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

  fetch: typeof fetch = (...args: any[]) => {
    return net.fetch(args[0], args[1] ? { ...args[1], bypassCustomProtocolHandlers: true } : undefined) as any
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

  relaunch() {
    app.relaunch()
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
      }
    })

    app.whenReady().then(() => {
      Menu.setApplicationMenu(null)
    })

    await super.setup()
  }
}
