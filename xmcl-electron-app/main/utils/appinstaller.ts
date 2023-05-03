import ElectronLauncherApp from '@/ElectronLauncherApp'
import { download } from '@xmcl/file-transfer'
import { BaseTask } from '@xmcl/task'
import { app, shell } from 'electron'
import { join } from 'path'
import { setTimeout } from 'timers/promises'

export type AppxUpdateType = '' | 'Unknown' | 'NoUpdates' | 'Available' | 'Required' | 'Error'

export class DownloadAppInstallerTask extends BaseTask<void> {
  constructor(readonly app: ElectronLauncherApp) {
    super()
  }

  protected async runTask(): Promise<void> {
    const destination = join(app.getPath('downloads'), 'X Minecraft Launcher.appinstaller')
    await download({
      url: 'https://xmcl.blob.core.windows.net/releases/xmcl.appinstaller',
      destination,
    })
    shell.showItemInFolder(destination)
    await setTimeout(1000)
    await shell.openPath(destination)
    this.app.exit()
  }

  protected async cancelTask(): Promise<void> {
  }

  protected async pauseTask(): Promise<void> {
  }

  protected async resumeTask(): Promise<void> {
  }
}
