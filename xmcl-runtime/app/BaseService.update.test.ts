import { Settings, SettingSchema, type ReleaseInfo } from '@xmcl/runtime-api'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../constant', () => ({ HAS_DEV_SERVER: false }))

import { BaseService } from './BaseService'

function setup() {
  const settings = new Settings()
  const info: ReleaseInfo = {
    name: '0.70.0', body: '', date: '', files: [], newUpdate: true, operation: 'autoupdater',
  }
  const updater = {
    checkUpdateTask: vi.fn(async () => info),
    downloadUpdate: vi.fn(async () => {}),
  }
  const task = { controller: new AbortController(), wrap: async (promise: Promise<void>) => promise }
  const service = Object.create(BaseService.prototype) as BaseService
  Object.assign(service, {
    app: { updater },
    getSettings: async () => settings,
    tasks: { create: () => task },
    log: vi.fn(),
    warn: vi.fn(),
  })
  return { service, settings, info, updater, task }
}

describe('launcher update state', () => {
  it('publishes runtime-only capability before returning settings and clears it for legacy adapters', async () => {
    const { service, settings, updater } = setup()
    const capability = { automatic: false, reason: 'not-implemented' } as const
    Object.assign(service, { app: { updater: { ...updater, capability }, registry: { get: async () => settings } } })
    expect(await BaseService.prototype.getSettings.call(service)).toBe(settings)
    expect(settings.updateCapability).toEqual(capability)
    expect(SettingSchema.parse(settings)).not.toHaveProperty('updateCapability')
    expect(settings.updateInfo).toBeNull()
    Object.assign(service, { app: { updater, registry: { get: async () => settings } } })
    await BaseService.prototype.getSettings.call(service)
    expect(settings.updateCapability).toBeUndefined()
  })

  it('contains background check failures and logs them without fabricating update state', async () => {
    const { service, settings, updater } = setup()
    const error = new Error('Automatic updates are not implemented for this host')
    error.name = 'UnsupportedUpdateError'
    updater.checkUpdateTask.mockRejectedValue(error)
    const before = { info: settings.updateInfo, status: settings.updateStatus }
    await expect(service.checkUpdateInBackground()).resolves.toBeUndefined()
    expect(service.warn).toHaveBeenCalledWith(error)
    expect(settings.updateInfo).toBe(before.info)
    expect(settings.updateStatus).toBe(before.status)
    // A later explicit user action must still reach the existing error handler.
    await expect(service.checkUpdate()).rejects.toBe(error)
    expect(error.name).toBe('UnsupportedUpdateError')
  })

  it('contains network errors during startup while preserving explicit check rejection', async () => {
    const { service, updater } = setup()
    updater.checkUpdateTask.mockRejectedValue(new Error('Network unavailable'))
    await expect(service.checkUpdateInBackground()).resolves.toBeUndefined()
    await expect(service.checkUpdate()).rejects.toMatchObject({ name: 'CheckUpdateError' })
  })

  it('preserves a ready update when the updater returns the same verified release', async () => {
    const { service, settings, info } = setup()
    settings.updateInfoSet(info)
    settings.updateStatusSet('ready')
    await service.checkUpdate()
    expect(settings.updateStatus).toBe('ready')
  })

  it('clears a stale update when the selected channel has no new version', async () => {
    const { service, settings, updater, info } = setup()
    settings.updateInfoSet(info)
    settings.updateStatusSet('ready')
    updater.checkUpdateTask.mockResolvedValue({ ...info, newUpdate: false })
    await service.checkUpdate()
    expect(settings.updateStatus).toBe('none')
  })

  it('marks newly discovered metadata pending', async () => {
    const { service, settings } = setup()
    await service.checkUpdate()
    expect(settings.updateStatus).toBe('pending')
  })

  it('forwards cancellation to the updater and does not mark a failed download ready', async () => {
    const { service, settings, info, updater, task } = setup()
    settings.updateInfoSet(info)
    settings.updateStatusSet('pending')
    updater.downloadUpdate.mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    await expect(service.downloadUpdate()).rejects.toThrow('Cancelled')
    expect(updater.downloadUpdate).toHaveBeenCalledWith(info, {
      tracker: expect.any(Function), abortSignal: task.controller.signal,
    })
    expect(settings.updateStatus).toBe('pending')
  })

  it('rejects a swallowed cancellation before completing the task and allows retry', async () => {
    const { service, settings, info, updater, task } = setup()
    settings.updateInfoSet(info)
    settings.updateStatusSet('pending')
    updater.downloadUpdate.mockImplementationOnce(async () => {
      task.controller.abort(new DOMException('Cancelled', 'AbortError'))
    })
    const wrap = vi.spyOn(task, 'wrap')
    await expect(service.downloadUpdate()).rejects.toThrow('Cancelled')
    await expect(wrap.mock.results[0].value).rejects.toThrow('Cancelled')
    expect(settings.updateStatus).toBe('pending')

    task.controller = new AbortController()
    await service.downloadUpdate()
    expect(settings.updateStatus).toBe('ready')
  })
})
