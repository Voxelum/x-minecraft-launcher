import { LauncherApp, LauncherAppController } from '@xmcl/runtime'
import { InstalledAppManifest, ReleaseInfo } from '@xmcl/runtime-api'
import { Host } from '@xmcl/runtime/lib/app/Host'
import { Task } from '@xmcl/task'
import { execSync } from 'child_process'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import Controller from './Controller'
import defaultApp from './defaultApp'
import { checkUpdateTask as _checkUpdateTask, DownloadAsarUpdateTask, DownloadFullUpdateTask, quitAndInstallAsar, quitAndInstallFullUpdate, setup } from './updater'
import { isDirectory } from './utils/fs'

export default class ElectronLauncherApp extends LauncherApp {
  host: Host = app

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

  checkUpdateTask(): Task<ReleaseInfo> {
    return _checkUpdateTask.bind(this)()
  }

  downloadUpdateTask(updateInfo: ReleaseInfo): Task<void> {
    if (updateInfo.incremental) {
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

    if (this.platform.name === 'linux') {
      const homePath = app.getPath('home')
      const desktopFile = join(homePath, '.local', 'share', 'applications', 'xmcl.desktop')
      try {
        writeFileSync(desktopFile, `[Desktop Entry]\nName=xmcl\nExec=${app.getPath('exe')} %u\nType=Application\nMimeType=x-scheme-handler/xmcl;`)
        this.log(`Try to set the linux desktop file ${desktopFile}`)
        const result = execSync('xdg-settings set default-url-scheme-handler xmcl xmcl.desktop')
        this.log(result)
      } catch (e) {
        this.error('Fail to set default protocol on linux:')
        this.error(e)

        try {
          const mimesAppsList = join(homePath, '.config', 'mimeapps.list')
          const content = readFileSync(mimesAppsList, 'utf-8')
          if (content.indexOf('x-scheme-handler/xmcl=xmcl.desktop') === -1) {
            let lines = content.split('\n')
            const defaultAppsHeaderIndex = lines.indexOf('[Default Applications]')
            if (defaultAppsHeaderIndex === -1) {
              lines.push('[Default Applications]')
              lines.push('x-scheme-handler/xmcl=xmcl.desktop')
            } else {
              lines = [...lines.slice(0, defaultAppsHeaderIndex + 1), 'x-scheme-handler/xmcl=xmcl.desktop', ...lines.slice(defaultAppsHeaderIndex + 1)]
            }
            writeFileSync(mimesAppsList, lines.join('\n'))
          }
        } catch (e) {
          this.error(e)
        }
      }
    }

    await super.setup()

    setup(this.serviceStateManager)
  }

  getLocale() {
    return app.getLocale()
  }
}
