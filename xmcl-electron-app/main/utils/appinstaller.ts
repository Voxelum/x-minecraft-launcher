import ElectronLauncherApp from '@/ElectronLauncherApp'
import { download } from '@xmcl/installer'
import { BaseTask } from '@xmcl/task'
import { checkUpdateAvailabilityAsync } from '@xmcl/windows-utils'
import { shell } from 'electron'
import { join } from 'path'

export type AppxUpdateType = '' | 'Unknown' | 'NoUpdates' | 'Available' | 'Required' | 'Error'

export async function checkAppxUpdate() {
  return new Promise<AppxUpdateType>((resolve) => {
    if (checkUpdateAvailabilityAsync((stat) => {
      switch (stat) {
        case 0:
          resolve('Unknown')
          break
        case 1:
          resolve('NoUpdates')
          break
        case 2:
          resolve('Available')
          break
        case 3:
          resolve('Required')
          break
        case 4:
          resolve('Error')
          break
        default:
          resolve('')
      }
    })) {
      resolve('')
    }
  })
}

export class DownloadAppInstallerTask extends BaseTask<void> {
  constructor(readonly app: ElectronLauncherApp) {
    super()
  }

  protected async runTask(): Promise<void> {
    const destination = join(this.app.appDataPath, 'xmcl.appinstaller')
    await download({
      url: 'https://xmcl.blob.core.windows.net/releases/xmcl.appinstaller',
      destination: destination,
    })
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
