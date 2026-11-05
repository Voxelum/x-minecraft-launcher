import { Settings, SettingSchema, type ReleaseInfo } from '@xmcl/runtime-api'
import { describe, expect, it, vi } from 'vitest'
import { BaseService } from './BaseService'

function setup() {
  const settings = new Settings()
  const info: ReleaseInfo = {
    name: 'XMCL 0.70.0', body: '', date: '', files: [], newUpdate: true, operation: 'autoupdater',
  }
  const updater = {
    capability: { automatic: false, reason: 'not-configured' } as const,
    checkUpdateTask: vi.fn(), downloadUpdate: vi.fn(), installUpdateAndQuit: vi.fn(),
  }
  const service = Object.create(BaseService.prototype) as BaseService
  Object.assign(service, {
    app: { updater, registry: { get: async () => settings } },
    log: vi.fn(), warn: vi.fn(),
  })
  return { service, settings, info, updater }
}

describe('Vardrynn update state', () => {
  it('publishes a runtime-only unavailable capability', async () => {
    const { service, settings, updater } = setup()
    expect(await service.getSettings()).toBe(settings)
    expect(settings.updateCapability).toEqual(updater.capability)
    expect(SettingSchema.parse(settings)).not.toHaveProperty('updateCapability')
  })

  it.each(['pending', 'ready'] as const)('clears cached upstream metadata in %s state before returning settings', async (status) => {
    const { service, settings, info } = setup()
    settings.updateInfoSet(info)
    settings.updateStatusSet(status)
    await service.getSettings()
    expect(settings.updateInfo).toBeNull()
    expect(settings.updateStatus).toBe('none')
  })

  it('does not discover updates on startup or explicit checks', async () => {
    const { service, settings, info, updater } = setup()
    settings.updateInfoSet(info)
    settings.updateStatusSet('ready')
    await service.checkUpdateInBackground()
    await service.checkUpdate()
    expect(updater.checkUpdateTask).not.toHaveBeenCalled()
    expect(settings.updateInfo).toBeNull()
    expect(settings.updateStatus).toBe('none')
  })

  it('rejects download and installation even with a cached upstream release', async () => {
    const { service, settings, info, updater } = setup()
    settings.updateInfoSet(info)
    settings.updateStatusSet('ready')
    await expect(service.downloadUpdate()).rejects.toThrow('unavailable')
    await expect(service.quitAndInstall()).rejects.toThrow('unavailable')
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(updater.installUpdateAndQuit).not.toHaveBeenCalled()
    expect(settings.updateInfo).toBeNull()
    expect(settings.updateStatus).toBe('none')
  })
})
