import { LauncherApp, LauncherAppController } from '@xmcl/runtime'
import { BaseServiceKey, InstalledAppManifest, UpdateInfo } from '@xmcl/runtime-api'
import { Host } from '@xmcl/runtime/lib/app/Host'
import { Task } from '@xmcl/task'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { writeFile } from 'fs-extra'
import { join } from 'path'
import Controller from './Controller'
import defaultApp from './defaultApp'
import { checkUpdateTask as _checkUpdateTask, DownloadAsarUpdateTask, DownloadFullUpdateTask, quitAndInstallAsar, quitAndInstallFullUpdate, setup } from './updater'
import { isDirectory } from './utils/fs'

export default class ElectronLauncherApp extends LauncherApp {
  host: Host = this.createHost()

  controller: LauncherAppController = new Controller(this)

  defaultAppManifest: InstalledAppManifest = defaultApp

  showItemInFolder = shell.showItemInFolder

  handle = ipcMain.handle

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

  private createHost(): Host {
    if (this.platform.name === 'linux') {
      const setAsDefaultProtocolClient: typeof app.setAsDefaultProtocolClient = (protocol) => {
        // const homePath = app.getPath('home')
        // const desktopFile = join(app.getPath('home'), '.local', 'share', 'applications', 'xmcl.desktop')
        // writeFileSync(desktopFile, `[Desktop Entry]\nName=xmcl\nExec=${app.getPath('exe')} %u\nType=Application\nMimeType=x-scheme-handler/xmcl;`)

        // const mimeAppsListFile = join(homePath, '.config', 'mimeapps.list')
        // readFileSync(mimeAppsListFile)
        return app.setAsDefaultProtocolClient(protocol)
      }
      return {
        ...app,
        setAsDefaultProtocolClient,
      }
    }
    return app
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
    shell.openExternal(url)
    return true
    // }
    // return false;
  }

  checkUpdateTask(): Task<UpdateInfo> {
    return _checkUpdateTask.bind(this)()
  }

  downloadUpdateTask(updateInfo: any): Task<void> {
    if (updateInfo.incremental) {
      const updatePath = join(this.appDataPath, 'pending_update')
      return new DownloadAsarUpdateTask(updateInfo as any, this.networkManager.isInGFW, updatePath)
        .map(() => undefined)
    }
    return new DownloadFullUpdateTask()
  }

  async installUpdateAndQuit(updateInfo: any): Promise<void> {
    if (updateInfo.incremental) {
      await quitAndInstallAsar.bind(this)()
    } else {
      quitAndInstallFullUpdate()
    }
  }

  waitEngineReady(): Promise<void> {
    return app.whenReady()
  }

  relaunch() {
    app.relaunch()
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

    setup(this.serviceStateManager)
  }

  getLocale() {
    return app.getLocale()
  }

  protected async onServiceReady() {
    this.parking = true

    this.log(`Current launcher core version is ${this.version}.`)

    await super.onServiceReady()

    this.serviceManager.getService(BaseServiceKey)?.state.localesSet(['en', 'zh-CN', 'ru'])
  }
}
