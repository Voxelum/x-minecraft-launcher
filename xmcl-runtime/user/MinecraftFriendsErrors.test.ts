import { describe, expect, it } from 'vitest'
import { MinecraftFriendsException } from '@xmcl/runtime-api'
import { MojangFriendsError } from '@xmcl/user'
import { translateMojangFriendsError } from './MinecraftFriendsErrors'

describe('translateMojangFriendsError', () => {
  it('classifies the friends-disabled 403 as a user-facing exception', () => {
    const result = translateMojangFriendsError(new MojangFriendsError('Failed to fetch friends list (status 403)', 403, {}))

    expect(result).toBeInstanceOf(MinecraftFriendsException)
    expect((result as MinecraftFriendsException).exception).toEqual({ type: 'minecraftFriends', reason: 'FRIENDS_DISABLED' })
  })

  it('classifies documented API sub-statuses as user-facing exceptions', () => {
    const result = translateMojangFriendsError(new MojangFriendsError('bad request', 400, { details: { status: 'UNKNOWN_PROFILE' } }))

    expect((result as MinecraftFriendsException).exception).toEqual({ type: 'minecraftFriends', reason: 'UNKNOWN_PROFILE' })
  })

  it('preserves unexpected Mojang failures for telemetry', () => {
    const error = new MojangFriendsError('Failed to fetch friends list (status 500)', 500, {})

    expect(translateMojangFriendsError(error)).toBe(error)
  })
})
