import { copyFileSync } from 'fs'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { MicrosoftOAuthClient } from './MicrosoftOAuthClient'

vi.mock('fs', () => ({
  copyFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

vi.mock('@azure/msal-node-extensions', () => ({
  NativeBrokerPlugin: class {
    isBrokerAvailable = true
  },
}))

describe(MicrosoftOAuthClient.name, () => {
  beforeEach(() => {
    vi.mocked(copyFileSync).mockClear()
  })

  test('prepares the native broker runtime once across concurrent clients', async () => {
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
  })
})