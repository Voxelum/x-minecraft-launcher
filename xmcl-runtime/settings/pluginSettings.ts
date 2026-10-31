import { SettingSchema, Settings } from '@xmcl/runtime-api'
import { readJson, writeJson } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { ServiceStateManager } from '~/service'
import { kSettings } from './settings'
import { getRestoreGate } from '~/infra/restoreGate'
import { recoverRestore } from '~/infra/recoverRestore'

export const pluginSettings: LauncherAppPlugin = async (app) => {
  const stateManager = await app.registry.get(ServiceStateManager)
  const state = stateManager.registerStatic(new Settings(), 'settings')
  const logger = app.getLogger('Settings')
  const settingJsonPath = join(app.appDataPath, 'setting.json')

  const gate = getRestoreGate(app)
  const saver = gate.writer(async () => {
    try {
      await writeJson(settingJsonPath, SettingSchema.parse(state), { spaces: 2 })
    } catch (e) {
      logger.warn(`Fail to save ${settingJsonPath}`)
      logger.warn(e as Error)
      throw e
    }
  }, 1000)
  app.registryDisposer(() => saver.flush())
  // Runtime status updates are not configuration and must remain usable by
  // network/update/background callbacks while persistent config is frozen.
  const runtimeMutations = ['localesSet', 'updateCapabilitySet', 'updateStatusSet', 'updateInfoSet', 'onlineSet', 'diskFullErrorSet', 'databaseReadySet', 'corruptedResourceCountSet', 'invalidGameDataPathSet']
  gate.guardState(state, runtimeMutations)

  const normalizeLocale = (locale: string) => {
    locale = locale || app.host.getLocale()
    if (locale.startsWith('en')) {
      locale = 'en'
    }
    return locale
  }

  await recoverRestore(app)
  await readJson(settingJsonPath).catch(() => ({})).then((rawData) => {
    // SettingSchema uses .catch() for each field, so invalid fields fallback to defaults automatically
    const data = SettingSchema.parse(rawData)
    data.locale = normalizeLocale(data.locale)
    state.config(data)
  }).catch((e) => {
    logger.error(e)
    // Still normalize locale with defaults when everything fails
    const data = SettingSchema.parse({})
    data.locale = normalizeLocale(data.locale)
    state.config(data)
  }).finally(() => {
    app.registry.register(kSettings, state)
    state.subscribeAll((mutation: string) => {
      if (runtimeMutations.includes(mutation)) return
      saver.schedule()
    })
  })
}
