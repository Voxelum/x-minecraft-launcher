import { SettingSchema, Settings } from '@xmcl/runtime-api'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { ServiceStateManager } from '~/service'
import { AggregateExecutor } from '../util/aggregator'
import { createSafeFile } from '../util/persistance'
import { kSettings } from './settings'

export const pluginSettings: LauncherAppPlugin = async (app) => {
  const stateManager = await app.registry.get(ServiceStateManager)
  const state = stateManager.registerStatic(new Settings(), 'settings')
  const logger = app.getLogger('Settings')
  const settingFile = createSafeFile(join(app.appDataPath, 'setting.json'), SettingSchema, logger, [])
  const saver = new AggregateExecutor<void, void>(() => { }, () =>
    settingFile.write({
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
      globalPrependCommand: state.globalPrependCommand,
      discordPresence: state.discordPresence,
      developerMode: state.developerMode,
      disableTelemetry: state.disableTelemetry,
      linuxTitlebar: state.linuxTitlebar,
      globalDisableAuthlibInjector: state.globalDisableAuthlibInjector,
      globalDisableElyByAuthlib: state.globalDisableElyByAuthlib,
      enableDedicatedGPUOptimization: state.enableDedicatedGPUOptimization,
      replaceNatives: state.replaceNatives,
    }), 1000)

  app.registryDisposer(async () => {
    return saver.flush()
  })

  settingFile.read().then(async () => {
    const data = await settingFile.read()
    data.locale = data.locale || app.host.getLocale()
    state.config(data)
  }).finally(() => {
    app.registry.register(kSettings, state)
    state.subscribeAll(() => {
      saver.push()
    })
  })
}
