import { describe, expect, afterEach, it, vi } from 'vitest'
import { AUTHORITY_MICROSOFT, Exception, type UserProfile } from '@xmcl/runtime-api'
import { UnauthorizedError } from '@xmcl/user'
import { MinecraftFriendsService } from './MinecraftFriendsService'

vi.mock('~/app', () => ({
  Inject: () => () => undefined,
  LauncherApp: class {},
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
}))

function createUser(id: string, expiredAt = Date.now() - 1_000): UserProfile {
  return {
    id,
    username: `${id}@example.invalid`,
    authority: AUTHORITY_MICROSOFT,
    expiredAt,
    invalidated: false,
    profiles: {},
    selectedProfile: '',
  }
}

function createService(tokens: Record<string, string | undefined>, refreshUser = vi.fn()) {
  const storage = {
    get: vi.fn(async (user: UserProfile) => tokens[user.id]),
  }
  const app = {
    getLogger: () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    registry: {
      get: vi.fn().mockResolvedValue(storage),
    },
  } as any
  const service = new MinecraftFriendsService(app, {} as any, { refreshUser } as any)
  return { service, storage, refreshUser }
}

describe('MinecraftFriendsService authentication retry policy', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not refresh repeatedly for a stale renderer expiry timestamp', async () => {
    const { service, refreshUser } = createService({ user: 'access-token' })

    await expect((service as any).getToken(createUser('user'))).resolves.toBe('access-token')

    expect(refreshUser).not.toHaveBeenCalled()
  })

  it('accepts the token after recovering a stale invalidated profile', async () => {
    const { service, refreshUser } = createService({ user: 'fresh-token' })
    refreshUser.mockResolvedValue(undefined)

    await expect((service as any).getToken({ ...createUser('user'), invalidated: true })).resolves.toBe('fresh-token')

    expect(refreshUser).toHaveBeenCalledOnce()
  })

  it('bounds missing-token refreshes per user', async () => {
    const { service, refreshUser } = createService({ first: undefined, second: undefined })
    refreshUser.mockRejectedValue(new Error('refresh unavailable'))

    await expect((service as any).getToken(createUser('first'))).rejects.toMatchObject({
      name: 'UserAuthenticationError',
      exception: { type: 'userAuthentication' },
    })
    await expect((service as any).getToken(createUser('first'))).rejects.toBeInstanceOf(Exception)
    await expect((service as any).getToken(createUser('second'))).rejects.toThrow('No access token')

    expect(refreshUser).toHaveBeenCalledTimes(2)
    expect(refreshUser).toHaveBeenNthCalledWith(1, 'first', { silent: true, force: true })
    expect(refreshUser).toHaveBeenNthCalledWith(2, 'second', { silent: true, force: true })
  })

  it('bounds a 401 retry and recovers after the cooldown', async () => {
    vi.useFakeTimers()
    const tokens = { user: 'stale-token' }
    const { service, refreshUser } = createService(tokens)
    refreshUser.mockRejectedValueOnce(new Error('refresh unavailable'))

    const operation = vi.fn()
      .mockRejectedValueOnce(new UnauthorizedError({}))
      .mockRejectedValueOnce(new UnauthorizedError({}))
      .mockRejectedValueOnce(new UnauthorizedError({}))
      .mockResolvedValueOnce('ok')
    await expect((service as any).withFreshToken(createUser('user'), operation)).rejects.toThrow('refresh failed')
    await expect((service as any).withFreshToken(createUser('user'), operation)).rejects.toThrow('temporarily unavailable')
    expect(refreshUser).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(60_001)
    tokens.user = 'fresh-token'
    refreshUser.mockResolvedValueOnce(createUser('user', Date.now() + 3_600_000))

    await expect((service as any).withFreshToken(createUser('user'), operation)).resolves.toBe('ok')
    expect(refreshUser).toHaveBeenCalledTimes(2)
  })
})
