import { Settings, SettingSchema, type ReleaseInfo } from '@xmcl/runtime-api'
import { describe, expect, it, vi } from 'vitest'
import { BaseService } from './BaseService'

const signed: ReleaseInfo = {
  name: '1.2.0', body: '', date: '', newUpdate: true, operation: 'verified',
  files: [{ name: 'v.dmg', url: 'https://downloads.example.com/v.dmg', platform: 'darwin', arch: 'arm64', sha256: 'a'.repeat(64), signature: 'sig' }],
}

function setup(configured = false) {
  const settings = new Settings()
  const info: ReleaseInfo = {
    name: 'XMCL 0.70.0', body: '', date: '', files: [], newUpdate: true, operation: 'autoupdater',
  }
  const updater = {
    capability: configured ? undefined : { automatic: false, reason: 'not-configured' } as const,
    checkUpdateTask: vi.fn(async () => signed), downloadUpdate: vi.fn(async () => {}), installUpdateAndQuit: vi.fn(async () => {}),
  }
  const service = Object.create(BaseService.prototype) as BaseService
  Object.assign(service, {
    app: { updater, registry: { get: async () => settings } },
    log: vi.fn(), warn: vi.fn(),
    tasks: { create: () => ({ controller: new AbortController(), wrap: (p: Promise<unknown>) => p, update: vi.fn() }) },
  })
  return { service, settings, info, updater }
}

describe('Vardrynn update state without a release source', () => {
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

  it('rejects download and installation even with a cached release', async () => {
    const { service, settings, updater } = setup()
    settings.updateInfoSet(signed)
    settings.updateStatusSet('ready')
    await expect(service.downloadUpdate()).rejects.toThrow('unavailable')
    await expect(service.quitAndInstall()).rejects.toThrow('unavailable')
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(updater.installUpdateAndQuit).not.toHaveBeenCalled()
  })
})

describe('Vardrynn update state with a release source', () => {
  it('drops unsigned cached XMCL metadata but keeps a signed release', async () => {
    const { service, settings, info } = setup(true)
    settings.updateInfoSet(info)
    settings.updateStatusSet('ready')
    await service.getSettings()
    expect(settings.updateInfo).toBeNull()
    expect(settings.updateStatus).toBe('none')

    settings.updateInfoSet(signed)
    settings.updateStatusSet('ready')
    await service.getSettings()
    expect(settings.updateInfo).toEqual(signed)
    expect(settings.updateStatus).toBe('ready')
  })

  it('records a newer release as pending, then ready after download', async () => {
    const { service, settings, updater } = setup(true)
    await service.checkUpdate()
    expect(settings.updateInfo).toEqual(signed)
    expect(settings.updateStatus).toBe('pending')
    await service.downloadUpdate()
    expect(updater.downloadUpdate).toHaveBeenCalledWith(signed, expect.anything())
    expect(settings.updateStatus).toBe('ready')
    await service.checkUpdate()
    expect(settings.updateStatus).toBe('ready')
  })

  it('reports no update when the release is not newer', async () => {
    const { service, settings, updater } = setup(true)
    updater.checkUpdateTask.mockResolvedValue({ ...signed, newUpdate: false })
    await service.checkUpdate()
    expect(settings.updateStatus).toBe('none')
  })

  it('installs only a ready update', async () => {
    const { service, settings, updater } = setup(true)
    settings.updateInfoSet(signed)
    settings.updateStatusSet('pending')
    await service.quitAndInstall()
    expect(updater.installUpdateAndQuit).not.toHaveBeenCalled()
    settings.updateStatusSet('ready')
    await service.quitAndInstall()
    expect(updater.installUpdateAndQuit).toHaveBeenCalledWith(signed)
  })

  it('offers the download again after a failed install', async () => {
    const { service, settings, updater } = setup(true)
    settings.updateInfoSet(signed)
    settings.updateStatusSet('ready')
    updater.installUpdateAndQuit.mockRejectedValueOnce(new Error('Staged update is missing'))
    await expect(service.quitAndInstall()).rejects.toThrow('Staged update is missing')
    expect(settings.updateStatus).toBe('pending')
    expect(settings.updateInfo).toEqual(signed)
  })

  it('keeps a missing release non-fatal and names other failures', async () => {
    const { service, updater } = setup(true)
    updater.checkUpdateTask.mockRejectedValueOnce(new Error('No update info found'))
    await expect(service.checkUpdate()).resolves.toBeUndefined()
    updater.checkUpdateTask.mockRejectedValueOnce(new Error('boom'))
    await expect(service.checkUpdate()).rejects.toMatchObject({ name: 'CheckUpdateError' })
  })
})
