import { AUTHORITY_MICROSOFT, type UserProfile } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import { UserService } from '~/user/UserService'
import { ExternalCredentialService } from './ExternalCredentialService'
import { pluginExternalCredentialLifecycle } from './pluginExternalCredentialLifecycle'

vi.mock('../user/UserService', () => ({
  UserService: class UserService {},
}))

const microsoftUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'microsoft-user-id',
  username: 'player@example.com',
  authority: AUTHORITY_MICROSOFT,
  invalidated: false,
  expiredAt: Date.now() + 60_000,
  profiles: {},
  selectedProfile: '',
  ...overrides,
})

describe('pluginExternalCredentialLifecycle', () => {
  it('notifies the main-process lifecycle after a valid Microsoft login without a token', async () => {
    const userService = new EventEmitter()
    const credentials = {
      initialize: vi.fn().mockResolvedValue(undefined),
      notifyMicrosoftCredentialChanged: vi.fn(),
    }
    const app = {
      getLogger: vi.fn().mockReturnValue({ warn: vi.fn() }),
      registry: {
        get: vi.fn().mockResolvedValue(userService),
        getOrCreate: vi.fn().mockResolvedValue(credentials),
      },
    }

    pluginExternalCredentialLifecycle(app as any, {} as any)
    await vi.waitFor(() => expect(userService.listenerCount('user-login-success')).toBe(1))
    userService.emit('user-login-success', microsoftUser())

    expect(credentials.notifyMicrosoftCredentialChanged).toHaveBeenCalledWith('microsoft-user-id')
    expect(app.registry.getOrCreate).toHaveBeenCalledWith(ExternalCredentialService)
    expect(app.registry.get).toHaveBeenCalledWith(UserService)
  })
})
