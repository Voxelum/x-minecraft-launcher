import { LauncherAppPlugin } from '@xmcl/runtime/app'
import { autoUpdater } from 'electron-updater'
import { kSettings } from '~/settings'

export const pluginAutoUpdate: LauncherAppPlugin = async (app) => {
  const state = await app.registry.get(kSettings)
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
}
