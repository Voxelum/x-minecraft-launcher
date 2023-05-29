import { BaseService, LauncherAppPlugin } from '@xmcl/runtime'
import { autoUpdater } from 'electron-updater'

export const pluginAutoUpdate: LauncherAppPlugin = (app) => {
  app.once('engine-ready', async () => {
    const baseService = await app.registry.get(BaseService)
    const state = await baseService.getSettings()

    state.subscribe('autoInstallOnAppQuitSet', (value) => {
      autoUpdater.autoInstallOnAppQuit = value
    }).subscribe('allowPrereleaseSet', (value) => {
      autoUpdater.allowPrerelease = value
    }).subscribe('autoDownloadSet', (value) => {
      autoUpdater.autoDownload = value
    }).subscribe('config', (config) => {
      autoUpdater.autoInstallOnAppQuit = config.autoInstallOnAppQuit
      autoUpdater.allowPrerelease = config.allowPrerelease
      autoUpdater.autoDownload = config.autoDownload
    })
  })
}
