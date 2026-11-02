import { describe, expect, it } from 'vitest'
import { Settings } from './setting'
import { SettingSchema } from './setting.schema'

describe('update settings', () => {
  it.each([undefined, null, 'invalid'])('defaults legacy or invalid ownership %s to external', (mode) => {
    expect(SettingSchema.parse({ appImageUpdateMode: mode }).appImageUpdateMode).toBe('external')
  })
  it('round-trips explicit ownership through persistent schema and config', () => {
    const state = new Settings()
    state.appImageUpdateModeSet('self-managed')
    const persisted = JSON.parse(JSON.stringify(SettingSchema.parse(state)))
    const restored = new Settings()
    restored.config(SettingSchema.parse(persisted))
    expect(restored.appImageUpdateMode).toBe('self-managed')
    restored.appImageUpdateModeSet('bad' as any)
    expect(restored.appImageUpdateMode).toBe('self-managed')
    restored.appImageUpdateModeSet('external')
    expect(SettingSchema.parse(restored).appImageUpdateMode).toBe('external')
  })
  it.each([[true, false], [false, true]])('loads download=%s and install-on-quit=%s independently', (autoDownload, autoInstallOnAppQuit) => {
    const settings = new Settings()
    settings.config(SettingSchema.parse({ autoDownload, autoInstallOnAppQuit }))
    expect(settings.autoDownload).toBe(autoDownload)
    expect(settings.autoInstallOnAppQuit).toBe(autoInstallOnAppQuit)
  })
})
