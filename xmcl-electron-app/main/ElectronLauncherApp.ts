import { LauncherApp, LauncherAppController } from '@xmcl/runtime'
import { InstalledAppManifest, ReleaseInfo } from '@xmcl/runtime-api'
import { Host } from '@xmcl/runtime/lib/app/Host'
import { AbstractService, ServiceConstructor } from '@xmcl/runtime/lib/services/Service'
import { Task } from '@xmcl/task'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { URL } from 'url'
import Controller from './Controller'
import defaultApp from './defaultApp'
import { preloadServices } from './preloadServices'
import { DownloadAppInstallerTask } from './utils/appinstaller'
import { isDirectory } from './utils/fs'
import { setLinuxProtocol } from './utils/protocol'
import { checkUpdateTask as _checkUpdateTask, DownloadAsarUpdateTask, DownloadFullUpdateTask, quitAndInstallAsar, quitAndInstallFullUpdate, setup } from './utils/updater'
import { getWindowsUtils } from './utils/windowsUtils'

export default class ElectronLauncherApp extends LauncherApp {
  host: Host = app

  controller: LauncherAppController = new Controller(this)

  builtinAppManifest: InstalledAppManifest = defaultApp

  showItemInFolder = shell.showItemInFolder

  handle = ipcMain.handle

  windowsUtils = getWindowsUtils(this)

  /**
   * Push a event with payload to client.
   *
   * @param channel The event channel to client
   * @param payload The event payload to client
   */
  broadcast(channel: string, ...payload: any[]): void {
    BrowserWindow.getAllWindows().forEach(w => {
      try {
        w.webContents.send(channel, ...payload)
      } catch (e) {
        this.warn(`Drop message to ${channel} to ${w.getTitle()} as`)
        if (e instanceof Error) {
          this.warn(e.stack)
        }
      }
    })
  }

  /**
   * A safe method that only open directory. If the `path` is a file, it won't execute it.
   * @param file The directory path
   */
  async openDirectory(path: string) {
    if (await isDirectory(path)) {
      return shell.openPath(path).then(r => r !== '')
    }
    return false
  }

  /**
   * Try to open a url in default browser. It will popup a message dialog to let user know.
   * If user does not trust the url, it won't open the site.
   * @param url The pending url
   */
  async openInBrowser(url: string) {
    // if ([...BUILTIN_TRUSTED_SITES, ...this.trustedSites].indexOf(url) === -1) {
    //     const result = await this.controller!.requestOpenExternalUrl(url);
    //     if (result) {
    //         this.trustedSites.push(url);
    //         shell.openExternal(url);
    //         return true;
    //     }
    // } else {
    await shell.openExternal(url)
    return true
    // }
    // return false;
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

  checkUpdateTask(): Task<ReleaseInfo> {
    return _checkUpdateTask.bind(this)()
  }

  downloadUpdateTask(updateInfo: ReleaseInfo): Task<void> {
    if (this.env === 'appx') {
      return new DownloadAppInstallerTask(this)
    }
    if (updateInfo.incremental && this.env === 'raw') {
      const updatePath = join(this.appDataPath, 'pending_update')
      return new DownloadAsarUpdateTask(updatePath, updateInfo.name)
        .map(() => undefined)
    }
    return new DownloadFullUpdateTask()
  }

  async installUpdateAndQuit(updateInfo: ReleaseInfo): Promise<void> {
    if (updateInfo.incremental) {
      await quitAndInstallAsar.bind(this)()
    } else {
      quitAndInstallFullUpdate()
    }
  }

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

  getPreloadServices(): ServiceConstructor<AbstractService>[] {
    return preloadServices
  }

  waitEngineReady(): Promise<void> {
    return app.whenReady()
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
      this.handleUrl(url)
    }).on('second-instance', (e, argv) => {
      const last = argv[argv.length - 1]
      if (last.startsWith('xmcl://')) {
        this.handleUrl(last)
      }
    })

    await super.setup()

    // if (this.platform.name === 'linux') {
    //   try {
    //     await setLinuxProtocol(app.getPath('home'), app.getPath('exe'))
    //   } catch (e) {
    //     this.error('Fail to set linux protocol! This might cause you cannot automatically login microsoft!')
    //     this.error(e)
    //   }
    // }

    setup(this.serviceStateManager)
  }

  getLocale() {
    return app.getLocale()
  }
}
