import {
  AUTHORITY_MICROSOFT,
  type MinecraftFriendsList,
  type MinecraftFriendsPreferences,
  type MinecraftFriendsService as IMinecraftFriendsService,
  MinecraftFriendsServiceKey,
  type UserProfile,
} from '@xmcl/runtime-api'
import { MojangClient, MojangFriendsError, UnauthorizedError } from '@xmcl/user'
import { AnyError } from '@xmcl/utils'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kUserTokenStorage } from '~/user'

const UserAuthenticationError = AnyError.make('UserAuthenticationError')
const MinecraftFriendsUnsupportedError = AnyError.make('MinecraftFriendsUnsupportedError')

interface CacheEntry {
  data: MinecraftFriendsList
  etag?: string
  expiresAt: number
  inFlight?: Promise<MinecraftFriendsList>
}

/**
 * Cooldown between consecutive `getFriends` cache misses (Mojang
 * recommends not polling more than once every ~10s).
 */
const REFRESH_COOLDOWN_MS = 10_000

@ExposeServiceKey(MinecraftFriendsServiceKey)
export class MinecraftFriendsService extends AbstractService implements IMinecraftFriendsService {
  private cache = new Map<string, CacheEntry>()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(MojangClient) private mojangApi: MojangClient,
  ) {
    super(app)
  }

  async getFriends(user: UserProfile, force?: boolean): Promise<MinecraftFriendsList> {
    this.assertSupported(user)
    const now = Date.now()
    const entry = this.cache.get(user.id)

    if (entry?.inFlight) return entry.inFlight
    if (!force && entry && entry.expiresAt > now) return entry.data

    const token = await this.getToken(user)
    const promise = (async () => {
      try {
        const result = await this.mojangApi.getFriends(token, force ? undefined : entry?.etag)
        if ('notModified' in result) {
          // Server says nothing changed — extend the cache window and reuse
          // the previous data.
          if (entry) {
            entry.expiresAt = Date.now() + REFRESH_COOLDOWN_MS
            if (result.etag) entry.etag = result.etag
            return entry.data
          }
          // Fallthrough — should not happen (no cached data + 304) but be
          // defensive: re-fetch without etag.
          const fresh = await this.mojangApi.getFriends(token)
          if ('notModified' in fresh) {
            const empty: MinecraftFriendsList = {
              friends: [], incomingRequests: [], outgoingRequests: [], fetchedAt: Date.now(),
            }
            this.cache.set(user.id, { data: empty, expiresAt: Date.now() + REFRESH_COOLDOWN_MS })
            return empty
          }
          const data: MinecraftFriendsList = {
            friends: fresh.friends,
            incomingRequests: fresh.incomingRequests,
            outgoingRequests: fresh.outgoingRequests,
            fetchedAt: Date.now(),
          }
          this.cache.set(user.id, { data, etag: fresh.etag, expiresAt: Date.now() + REFRESH_COOLDOWN_MS })
          return data
        }
        const data: MinecraftFriendsList = {
          friends: result.friends,
          incomingRequests: result.incomingRequests,
          outgoingRequests: result.outgoingRequests,
          fetchedAt: Date.now(),
        }
        this.cache.set(user.id, { data, etag: result.etag, expiresAt: Date.now() + REFRESH_COOLDOWN_MS })
        return data
      } catch (e) {
        throw this.translateError(e)
      } finally {
        const cached = this.cache.get(user.id)
        if (cached) cached.inFlight = undefined
      }
    })()

    if (entry) {
      entry.inFlight = promise
    } else {
      this.cache.set(user.id, {
        data: { friends: [], incomingRequests: [], outgoingRequests: [], fetchedAt: 0 },
        expiresAt: 0,
        inFlight: promise,
      })
    }
    return promise
  }

  async addFriendByName(user: UserProfile, name: string): Promise<void> {
    this.assertSupported(user)
    const trimmed = name.trim()
    if (!trimmed) {
      throw new AnyError('MinecraftFriendsError', 'Player name cannot be empty')
    }
    const token = await this.getToken(user)
    try {
      await this.mojangApi.addFriend(token, { name: trimmed })
    } catch (e) {
      throw this.translateError(e)
    }
    this.invalidate(user.id)
  }

  async acceptFriendRequest(user: UserProfile, profileId: string): Promise<void> {
    this.assertSupported(user)
    const token = await this.getToken(user)
    try {
      await this.mojangApi.addFriend(token, { profileId })
    } catch (e) {
      throw this.translateError(e)
    }
    this.invalidate(user.id)
  }

  async declineFriendRequest(user: UserProfile, profileId: string): Promise<void> {
    return this.removeByProfileId(user, profileId)
  }

  async revokeFriendRequest(user: UserProfile, profileId: string): Promise<void> {
    return this.removeByProfileId(user, profileId)
  }

  async removeFriend(user: UserProfile, profileId: string): Promise<void> {
    return this.removeByProfileId(user, profileId)
  }

  async getFriendsPreferences(user: UserProfile): Promise<MinecraftFriendsPreferences> {
    this.assertSupported(user)
    const token = await this.getToken(user)
    try {
      const attrs = await this.mojangApi.getPlayerAttributes(token)
      return {
        friendsEnabled: attrs.friendsPreferences?.friends !== 'DISABLED',
        acceptInvites: attrs.friendsPreferences?.acceptInvites !== 'DISABLED',
      }
    } catch (e) {
      throw this.translateError(e)
    }
  }

  async setFriendsPreferences(user: UserProfile, prefs: Partial<MinecraftFriendsPreferences>): Promise<MinecraftFriendsPreferences> {
    this.assertSupported(user)
    const token = await this.getToken(user)
    try {
      // The API requires both fields; merge with current values when only one is provided.
      let friendsEnabled = prefs.friendsEnabled
      let acceptInvites = prefs.acceptInvites
      if (friendsEnabled === undefined || acceptInvites === undefined) {
        const attrs = await this.mojangApi.getPlayerAttributes(token)
        if (friendsEnabled === undefined) {
          friendsEnabled = attrs.friendsPreferences?.friends !== 'DISABLED'
        }
        if (acceptInvites === undefined) {
          acceptInvites = attrs.friendsPreferences?.acceptInvites !== 'DISABLED'
        }
      }
      await this.mojangApi.updatePlayerAttributes(token, {
        friendsEnabled,
        acceptInvites,
      })
      return { friendsEnabled: friendsEnabled!, acceptInvites: acceptInvites! }
    } catch (e) {
      throw this.translateError(e)
    }
  }

  // ---------- helpers ----------

  private async removeByProfileId(user: UserProfile, profileId: string): Promise<void> {
    this.assertSupported(user)
    const token = await this.getToken(user)
    try {
      await this.mojangApi.removeFriend(token, { profileId })
    } catch (e) {
      throw this.translateError(e)
    }
    this.invalidate(user.id)
  }

  private invalidate(userId: string) {
    const entry = this.cache.get(userId)
    if (entry) entry.expiresAt = 0
  }

  private assertSupported(user: UserProfile) {
    if (user.authority !== AUTHORITY_MICROSOFT) {
      throw new MinecraftFriendsUnsupportedError(
        'Minecraft friends are only available for Microsoft accounts',
      )
    }
  }

  private async getToken(user: UserProfile): Promise<string> {
    const userTokenStorage = await this.app.registry.get(kUserTokenStorage)
    const token = await userTokenStorage.get(user)
    if (!token) {
      throw new UserAuthenticationError('No access token available for user')
    }
    return token
  }

  private translateError(e: unknown): unknown {
    if (e instanceof UnauthorizedError) {
      return new UserAuthenticationError('Minecraft access token is invalid or expired', { cause: e })
    }
    return e
  }
}

export { MojangFriendsError }
