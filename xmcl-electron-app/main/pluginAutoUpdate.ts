import { LauncherAppPlugin } from '@xmcl/runtime/app'
import { autoUpdater } from 'electron-updater'
import { kSettings } from '~/settings'
import { applyAutoUpdateSettings } from './utils/appImageUpdatePolicy'

export const pluginAutoUpdate: LauncherAppPlugin = async (app) => {
  // E2E hook: skip the auto-updater entirely when running under Playwright.
  // The updater hits real network endpoints and would otherwise add nondeterminism.
  if (process.env.XMCL_E2E) {
    return
  }
  // electron-updater defaults to automatic download/install. Disable both before
  // awaiting settings so a persisted opt-out (or AppImage policy) is effective.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  const state = await app.registry.get(kSettings)
  const apply = () => applyAutoUpdateSettings(autoUpdater, state, app.env)
  apply()
  state.subscribe('autoInstallOnAppQuitSet', (value) => {
    applyAutoUpdateSettings(autoUpdater, { ...state, autoInstallOnAppQuit: value }, app.env)
  }).subscribe('allowPrereleaseSet', (value) => {
    autoUpdater.allowPrerelease = value
  }).subscribe('autoDownloadSet', (value) => {
    applyAutoUpdateSettings(autoUpdater, { ...state, autoDownload: value }, app.env)
  }).subscribe('appImageUpdateModeSet', (mode) => {
    applyAutoUpdateSettings(autoUpdater, { ...state, appImageUpdateMode: mode }, app.env)
    // Force fresh discovery rather than offering an action from the old mode.
    if (app.env === 'appimage') state.updateStatusSet('none')
  }).subscribe('config', (config) => {
    applyAutoUpdateSettings(autoUpdater, config, app.env)
  })
}
