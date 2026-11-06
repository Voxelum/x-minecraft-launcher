import type { LauncherAppPlugin } from '@xmcl/runtime/app'
import { autoUpdater } from 'electron-updater'

/** Prevent electron-updater from applying cached XMCL metadata on quit. */
export const pluginAutoUpdate: LauncherAppPlugin = () => {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
}
