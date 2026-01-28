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
    const data = SettingSchema.parse(state)
    await writeJson(settingJsonPath, data, { spaces: 2 })
  }, 1000)

  app.registryDisposer(async () => {
    return saver.flush()
  })

  const normalizeLocale = (locale: string) => {
    locale = locale || app.host.getLocale()
    if (locale.startsWith('en')) {
      locale = 'en'
    }
    return locale
  }

  readJson(settingJsonPath).catch(() => ({})).then((rawData) => {
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
    state.subscribeAll(() => {
      saver.push()
    })
  })
}
