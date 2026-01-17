import { SettingSchema, Settings } from '@xmcl/runtime-api'
import { AggregateExecutor } from '@xmcl/utils'
import { readJson, writeJson } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { ServiceStateManager } from '~/service'
import { kSettings } from './settings'

export const pluginSettings: LauncherAppPlugin = async (app) => {
  const stateManager = await app.registry.get(ServiceStateManager)
  const state = stateManager.registerStatic(new Settings(), 'settings')
  const logger = app.getLogger('Settings')
  const settingJsonPath = join(app.appDataPath, 'setting.json')

  const saver = new AggregateExecutor<void, void>(() => { }, async () => {
    const data = SettingSchema.parse({
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
      windowTranslucent: state.windowTranslucent,
      globalDisableAuthlibInjector: state.globalDisableAuthlibInjector,
      globalDisableElyByAuthlib: state.globalDisableElyByAuthlib,
      enableDedicatedGPUOptimization: state.enableDedicatedGPUOptimization,
      replaceNatives: state.replaceNatives,
      globalEnv: state.globalEnv,
      globalPreExecuteCommand: state.globalPreExecuteCommand,
      globalResolution: state.globalResolution,
    })
    await writeJson(settingJsonPath, data, { spaces: 2 })
  }, 1000)

  app.registryDisposer(async () => {
    return saver.flush()
  })

  readJson(settingJsonPath).catch(() => ({})).then(d => SettingSchema.parse(d)).then(async (data) => {
    data.locale = data.locale || app.host.getLocale()
    if (data.locale.startsWith('en')) {
      data.locale = 'en'
    }
    state.config(data)
  }).catch((e) => {
    logger.error(e)
  }).finally(() => {
    app.registry.register(kSettings, state)
    state.subscribeAll(() => {
      saver.push()
    })
  })
}
