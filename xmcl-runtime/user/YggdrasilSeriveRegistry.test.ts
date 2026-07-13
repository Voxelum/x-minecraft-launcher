import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readJson } from 'fs-extra'
import { YggdrasilSeriveRegistry } from './YggdrasilSeriveRegistry'
import { loadYggdrasilApiProfile } from './user'

vi.mock('fs-extra', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
}))

vi.mock('~/infra', () => ({
  kFlights: Symbol('kFlights'),
}))

vi.mock('./user', () => ({
  loadYggdrasilApiProfile: vi.fn(),
}))

describe('YggdrasilSeriveRegistry', () => {
  const logger = {
    log: vi.fn(),
    warn: vi.fn(),
  }
  const app = {
    appDataPath: '/mock/app/data',
    fetch: vi.fn(),
    getLogger: vi.fn(() => logger),
    protocol: { registerHandler: vi.fn() },
    registry: { get: vi.fn().mockResolvedValue({}) },
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadYggdrasilApiProfile)
      .mockResolvedValueOnce({ url: 'https://littleskin.cn/api/yggdrasil' })
      .mockResolvedValueOnce({ url: 'https://authserver.ely.by/api/authlib-injector' })
      .mockResolvedValueOnce({ url: 'https://littleskin.cn/api/yggdrasil' })
      .mockResolvedValueOnce({ url: 'https://authserver.ely.by/api/authlib-injector' })
  })

  it('falls back to defaults when persisted service metadata is invalid', async () => {
    vi.mocked(readJson).mockResolvedValue({
      yggdrasilServices: [{
        url: 'https://example.com/api/yggdrasil',
        authlibInjector: { meta: { links: { homepage: 42 } } },
      }],
    })

    const registry = new YggdrasilSeriveRegistry(app)

    await registry.load()

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to load Yggdrasil services. Falling back to defaults.',
      expect.anything(),
    )
    expect(registry.getYggdrasilServices()).toEqual([
      { url: 'https://littleskin.cn/api/yggdrasil' },
      { url: 'https://authserver.ely.by/api/authlib-injector' },
    ])
  })
})