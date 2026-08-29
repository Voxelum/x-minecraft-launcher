import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { UserService } from './UserService'
import { pluginModrinthAccess } from './pluginModrinthAccess'
import { formatModrinthAuthorization } from './utils/loginModrinth'

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
    await credentials.store('modrinth', { accessToken: 'test_modrinth_value' })
    const userService = new EventEmitter()
    vi.spyOn(userService, 'emit')
    registry.get.mockResolvedValue(userService)
    registry.getOrCreate.mockResolvedValue(credentials)

    await pluginModrinthAccess(app as any, {} as any)
    expect(registry.get).not.toHaveBeenCalled()
    expect(registry.getOrCreate).not.toHaveBeenCalled()

    const request = {
      url: new URL('https://api.modrinth.com/v2/user'),
      headers: {} as Record<string, string>,
    }
    await handlers.get('https')!({ request, response: {} })

    expect(request.headers.Authorization).toBe(formatModrinthAuthorization('test_modrinth_value'))
    expect(registry.get).not.toHaveBeenCalled()
    expect(registry.getOrCreate).toHaveBeenCalledWith(ExternalCredentialService)

    const response = {} as Record<string, unknown>
    handlers.get('xmcl')!({
      request: {
        url: new URL('xmcl://launcher/modrinth-auth?code=abc'),
      },
      response,
    })

    await vi.waitFor(() => expect(userService.emit).toHaveBeenCalledWith('modrinth-authorize-code', undefined, 'abc'))
    expect(registry.get).toHaveBeenCalledWith(UserService)
    expect(response.status).toBe(200)
  })
})
