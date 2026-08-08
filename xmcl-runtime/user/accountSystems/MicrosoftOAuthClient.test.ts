import { copyFileSync } from 'fs'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { MicrosoftOAuthClient } from './MicrosoftOAuthClient'

vi.mock('fs', () => ({
  copyFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const nativeBrokerPluginConstructed = vi.hoisted(() => ({ count: 0 }))

vi.mock('@azure/msal-node-extensions', () => ({
  NativeBrokerPlugin: class {
    constructor() {
      nativeBrokerPluginConstructed.count += 1
    }

    isBrokerAvailable = true
  },
}))

describe(MicrosoftOAuthClient.name, () => {
  beforeEach(() => {
    vi.mocked(copyFileSync).mockClear()
    nativeBrokerPluginConstructed.count = 0
  })

  test('serializes native broker initialization across concurrent clients', async () => {
    const createClient = () => new MicrosoftOAuthClient(
      vi.fn(),
      { log: vi.fn(), warn: vi.fn() } as any,
      'client-id',
      vi.fn(),
      vi.fn(),
      vi.fn(),
      {} as any,
    )

    const first = createClient()
    const second = createClient()

    await Promise.all([
      (first as any).getNativeBrokerPlugin(),
      (second as any).getNativeBrokerPlugin(),
    ])

    expect(copyFileSync).toHaveBeenCalledTimes(2)
    expect(nativeBrokerPluginConstructed.count).toBe(1)
  })
})