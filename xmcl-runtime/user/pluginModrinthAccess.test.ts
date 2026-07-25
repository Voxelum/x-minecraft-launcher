import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { UserService } from './UserService'
import { pluginModrinthAccess } from './pluginModrinthAccess'

vi.mock('./UserService', () => ({
  UserService: class UserService {},
}))

function createStorage() {
  const values = new Map<string, string>()
  return {
    values,
    get: vi.fn(async (service: string, account: string) => values.get(`${service}/${account}`)),
    put: vi.fn(async (service: string, account: string, value: string) => {
      values.set(`${service}/${account}`, value)
    }),
  }
}

describe('pluginModrinthAccess', () => {
  it('injects only a valid main-process credential into Modrinth request headers', async () => {
    const storage = createStorage()
    const handlers = new Map<string, Function>()
    const registry = {
      get: vi.fn(),
      getOrCreate: vi.fn(),
    }
    const app = Object.assign(new EventEmitter(), {
      secretStorage: storage,
      getLogger: vi.fn().mockReturnValue({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
      controller: {
        getLoginSuccessHTML: vi.fn().mockReturnValue('ok'),
      },
      protocol: {
        registerHandler: vi.fn((scheme: string, handler: Function) =>
          handlers.set(scheme, handler),
        ),
      },
      registry,
    })
    const credentials = new ExternalCredentialService(app as any)
    await credentials.store('modrinth', { accessToken: 'modrinth-access-token' })
    registry.get.mockResolvedValue(new EventEmitter())
    registry.getOrCreate.mockResolvedValue(credentials)

    await pluginModrinthAccess(app as any, {} as any)

    const request = {
      url: new URL('https://api.modrinth.com/v2/user'),
      headers: {} as Record<string, string>,
    }
    await handlers.get('https')!({ request, response: {} })

    expect(request.headers.Authorization).toBe('modrinth-access-token')
    expect(registry.get).toHaveBeenCalledWith(UserService)
    expect(registry.getOrCreate).toHaveBeenCalledWith(ExternalCredentialService)
  })
})
