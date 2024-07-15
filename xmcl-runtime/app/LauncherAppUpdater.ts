import { ReleaseInfo } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'

export interface LauncherAppUpdater {
  /**
   * Check update for the x-minecraft-launcher-core
   */
  checkUpdate(signal?: AbortSignal): Promise<ReleaseInfo>

  /**
    * Download the update to the disk. You should first call `checkUpdate`
    */
  downloadUpdate(updateInfo: ReleaseInfo, signal?: AbortSignal): Promise<void>

  /**
    * Install update and quit the app.
    */
  installUpdateAndQuit(updateInfo: ReleaseInfo): Promise<void>
}
