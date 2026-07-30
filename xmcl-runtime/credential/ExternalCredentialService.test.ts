import { describe, expect, it, vi } from 'vitest'
import { getServiceKey } from '~/service/Service'
import { ExternalCredentialService } from './ExternalCredentialService'

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed))
  const get = vi.fn(async (service: string, account: string) => values.get(`${service}/${account}`))
  const put = vi.fn(async (service: string, account: string, value: string) => {
    values.set(`${service}/${account}`, value)
  })
  return { values, get, put }
}

function createService(seed: Record<string, string> = {}) {
  const storage = createStorage(seed)
  const app = {
    secretStorage: storage,
    getLogger: vi.fn().mockReturnValue({
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }
  return {
    service: new ExternalCredentialService(app as any),
    storage,
  }
}

describe('ExternalCredentialService', () => {
  it('migrates a legacy Modrinth credential only after verifying the new record', async () => {
    const issuedAt = Date.now()
    const { service, storage } = createService({
      'modrinth/MODRINTH_USER': JSON.stringify({
        access_token: 'legacy-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
        issued_at: issuedAt,
      }),
    })

    await expect(service.getValidAccessToken('modrinth')).resolves.toEqual({
      status: 'valid',
      accessToken: 'legacy-access-token',
      expiresAt: issuedAt + 3_600_000,
    })

    expect(JSON.parse(storage.values.get('xmcl-external-credentials/modrinth')!)).toMatchObject({
      version: 1,
      provider: 'modrinth',
      accessToken: 'legacy-access-token',
      issuedAt,
      expiresAt: issuedAt + 3_600_000,
    })
    expect(storage.put).toHaveBeenCalledWith('modrinth', 'MODRINTH_USER', '')
  })

  it('keeps reading the legacy record when migration cannot be verified', async () => {
    const storage = createStorage({
      'modrinth/MODRINTH_USER': JSON.stringify({
        access_token: 'legacy-access-token',
      }),
    })
    storage.put.mockImplementation(async (service: string, account: string, value: string) => {
      if (service !== 'xmcl-external-credentials') {
        storage.values.set(`${service}/${account}`, value)
      }
    })
    const app = {
      secretStorage: storage,
      getLogger: vi.fn().mockReturnValue({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    }
    const service = new ExternalCredentialService(app as any)

    await expect(service.getValidAccessToken('modrinth')).resolves.toMatchObject({
      status: 'valid',
      accessToken: 'legacy-access-token',
    })

    expect(storage.values.get('modrinth/MODRINTH_USER')).toContain('legacy-access-token')
    expect(storage.put).not.toHaveBeenCalledWith('modrinth', 'MODRINTH_USER', '')
  })

  it('returns an explicit reauthorization outcome for an expired credential', async () => {
    const { service } = createService()
    await service.store('modrinth', {
      accessToken: 'expired-access-token',
      expiresAt: Date.now() - 1,
    })

    await expect(service.getValidAccessToken('modrinth')).resolves.toEqual({
      status: 'needs-reauthorization',
      reason: 'expired',
    })
  })

  it('does not invent a refresh when no provider refresher is registered', async () => {
    const { service, storage } = createService()
    await service.store('modrinth', {
      accessToken: 'expired-access-token',
      refreshToken: 'provider-refresh-token',
      expiresAt: Date.now() - 1,
    })
    storage.put.mockClear()

    await expect(service.getValidAccessToken('modrinth')).resolves.toEqual({
      status: 'needs-reauthorization',
      reason: 'refresh-unavailable',
    })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('emits one token-free change after storing a credential', async () => {
    const { service } = createService()
    const changes: unknown[] = []
    service.onCredentialChange((change) => changes.push(change))

    await service.store('modrinth', {
      accessToken: 'access-token',
      subject: 'modrinth-user-id',
    })

    expect(changes).toEqual([
      {
        provider: 'modrinth',
        type: 'stored',
        occurredAt: expect.any(Number),
        subject: 'modrinth-user-id',
      },
    ])
    expect(changes[0]).not.toHaveProperty('accessToken')
  })

  it('has no renderer service key', () => {
    expect(getServiceKey(ExternalCredentialService)).toBeUndefined()
  })
})
