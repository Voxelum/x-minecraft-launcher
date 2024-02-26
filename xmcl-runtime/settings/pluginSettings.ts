import { SettingSchema, Settings } from '@xmcl/runtime-api'
import { join } from 'path'
import { LauncherAppPlugin, kGameDataPath } from '~/app'
import { ServiceStateManager } from '~/service'
import { AggregateExecutor } from '../util/aggregator'
import { createSafeFile } from '../util/persistance'
import { kSettings } from './settings'

export const pluginSettings: LauncherAppPlugin = async (app) => {
  const stateManager = await app.registry.get(ServiceStateManager)
  const state = stateManager.register('settings', new Settings(), () => { })
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
      globalDisableAuthlibInjector: state.globalDisableAuthlibInjector,
      globalDisableElyByAuthlib: state.globalDisableElyByAuthlib,
      enableDedicatedGPUOptimization: state.enableDedicatedGPUOptimization,
      replaceNatives: state.replaceNatives,
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
