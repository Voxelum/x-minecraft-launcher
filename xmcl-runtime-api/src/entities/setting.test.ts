import { describe, expect, it } from 'vitest'
import { Settings } from './setting'
import { SettingSchema } from './setting.schema'

describe('update settings', () => {
  it.each([[true, false], [false, true]])('loads download=%s and install-on-quit=%s independently', (autoDownload, autoInstallOnAppQuit) => {
    const settings = new Settings()
    settings.config(SettingSchema.parse({ autoDownload, autoInstallOnAppQuit }))
    expect(settings.autoDownload).toBe(autoDownload)
    expect(settings.autoInstallOnAppQuit).toBe(autoInstallOnAppQuit)
  })
})
