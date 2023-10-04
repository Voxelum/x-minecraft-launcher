import { SettingSchema, Settings } from '@xmcl/runtime-api'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { createSafeFile } from '../util/persistance'
import { AggregateExecutor } from '../util/aggregator'
import { join } from 'path'
import { kSettings } from '../entities/settings'
import { kGameDataPath } from '../entities/gameDataPath'

export const pluginSettings: LauncherAppPlugin = (app) => {
  const state = app.serviceStateManager.register('settings', new Settings(), () => { })
  const logger = app.getLogger('Settings')
  app.registry.get(kGameDataPath).then(getPath => {
    const settingFile = createSafeFile(join(app.appDataPath, 'setting.json'), SettingSchema, logger, [getPath('setting.json')])
    const saver = new AggregateExecutor<void, void>(() => { }, () => settingFile.write({
      locale: state.locale,
      autoInstallOnAppQuit: state.autoInstallOnAppQuit,
      autoDownload: state.autoDownload,
      allowPrerelease: state.allowPrerelease,
      apiSets: state.apiSets,
      apiSetsPreference: state.apiSetsPreference,
      allowTurn: state.allowTurn,
      httpProxy: state.httpProxy,
      httpProxyEnabled: state.httpProxyEnabled,
      theme: state.theme,
      maxSockets: state.maxSockets,
      globalMinMemory: state.globalMinMemory,
      globalMaxMemory: state.globalMaxMemory,
      globalAssignMemory: state.globalAssignMemory,
      globalVmOptions: state.globalVmOptions,
      globalMcOptions: state.globalMcOptions,
      globalFastLaunch: state.globalFastLaunch,
      globalHideLauncher: state.globalHideLauncher,
      globalShowLog: state.globalShowLog,
      discordPresence: state.discordPresence,
      developerMode: state.developerMode,
      disableTelemetry: state.disableTelemetry,
      linuxTitlebar: state.linuxTitlebar,
    }), 1000)

    settingFile.read().then(async () => {
      const data = await settingFile.read()
      data.locale = data.locale || app.getPreferredLocale() || app.host.getLocale()
      state.config(data)
    }).finally(() => {
      app.registry.register(kSettings, state)
      state.subscribeAll(() => {
        saver.push()
      })
    })
  })
}
