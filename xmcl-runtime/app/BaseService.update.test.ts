import { Settings, type ReleaseInfo } from '@xmcl/runtime-api'
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
  })
  return { service, settings, info, updater, task }
}

describe('launcher update state', () => {
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
