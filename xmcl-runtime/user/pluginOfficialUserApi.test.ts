import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserService } from './UserService'
import { pluginOfficialUserApi } from './pluginOfficialUserApi'

vi.mock('@xmcl/user', () => ({
  MicrosoftAuthenticator: class MicrosoftAuthenticator {},
  MojangClient: class MojangClient {},
}))

vi.mock('./UserService', () => ({
  UserService: class UserService {},
}))

vi.mock('./accountSystems/MicrosoftAccountSystem', () => ({
  MicrosoftAccountSystem: class MicrosoftAccountSystem {},
}))

vi.mock('./accountSystems/MicrosoftOAuthClient', () => ({
  MicrosoftOAuthClient: class MicrosoftOAuthClient {},
}))

vi.mock('./utils/withRetry', () => ({
  withRetry: (fetch: unknown) => fetch,
}))

describe('pluginOfficialUserApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers Microsoft support before eagerly initializing persisted users', async () => {
    const calls: string[] = []
    const userService = {
      registerAccountSystem: vi.fn(() => { calls.push('register') }),
      initialize: vi.fn(async () => { calls.push('initialize') }),
      emit: vi.fn(),
      once: vi.fn(),
    }
    const app = {
      registry: {
        get: vi.fn().mockResolvedValue({}),
        getOrCreate: vi.fn(async (type: unknown) => {
          expect(type).toBe(UserService)
          calls.push('create')
          return userService
        }),
        register: vi.fn(),
      },
      getLogger: vi.fn().mockReturnValue({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
      fetch: vi.fn(),
      secretStorage: { get: vi.fn(), put: vi.fn() },
      controller: {},
      shell: { openInBrowser: vi.fn() },
      protocol: { registerHandler: vi.fn() },
      serverPort: Promise.resolve(25555),
      emit: vi.fn(),
    }

    await pluginOfficialUserApi(app as any, {} as any)

    expect(calls).toEqual(['create', 'register', 'initialize'])
    expect(userService.registerAccountSystem).toHaveBeenCalledWith(
      AUTHORITY_MICROSOFT,
      expect.anything(),
    )
  })
})