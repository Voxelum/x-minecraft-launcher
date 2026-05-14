import type { UserProfile } from '../entities/user.schema'
import type { ServiceKey } from './Service'

/**
 * A friend / friend-request entry returned by Minecraft Services.
 */
export interface MinecraftFriend {
  /**
   * The profile uuid (hyphens stripped, lowercase).
   */
  profileId: string
  /**
   * The Minecraft player name.
   */
  name: string
  /**
   * Optional ISO-8601 timestamp from the server (when the friendship was
   * added or when the request was made).
   */
  addedAt?: string
  /**
   * For pending requests: when the request will expire on the server.
   */
  expiresAt?: string
}

/**
 * The friends list payload returned by {@link MinecraftFriendsService.getFriends}.
 */
export interface MinecraftFriendsList {
  friends: MinecraftFriend[]
  incomingRequests: MinecraftFriend[]
  outgoingRequests: MinecraftFriend[]
  /**
   * Server-provided timestamp (ms since epoch) for when the launcher last
   * fetched / refreshed this payload. Useful for "Last updated" labels.
   */
  fetchedAt: number
}

/**
 * Whether the player allows being added by friends and shows up in friend
 * lists.
 */
export interface MinecraftFriendsPreferences {
  /**
   * Whether the friend list feature is enabled for this player.
   */
  friendsEnabled: boolean
  /**
   * Whether incoming friend invites are accepted.
   */
  acceptInvites: boolean
}

export interface MinecraftFriendsService {
  /**
   * Get the friends + incoming + outgoing requests for the given user.
   *
   * The result is cached per-user for a short window; pass `force` to bypass
   * the cache.
   *
   * Will throw with a {@link MinecraftFriendsError} on API errors.
   *
   * Only valid for users authenticated through Microsoft / Mojang official
   * services. Calling this for a third-party Yggdrasil or offline user will
   * throw `unsupported`.
   */
  getFriends(user: UserProfile, force?: boolean): Promise<MinecraftFriendsList>

  /**
   * Send a friend request to the player with the given Minecraft username.
   */
  addFriendByName(user: UserProfile, name: string): Promise<void>

  /**
   * Accept an incoming friend request (the request must already exist on the
   * server).
   */
  acceptFriendRequest(user: UserProfile, profileId: string): Promise<void>

  /**
   * Decline an incoming friend request.
   */
  declineFriendRequest(user: UserProfile, profileId: string): Promise<void>

  /**
   * Revoke an outgoing friend request that we previously sent.
   */
  revokeFriendRequest(user: UserProfile, profileId: string): Promise<void>

  /**
   * Remove an existing friend.
   */
  removeFriend(user: UserProfile, profileId: string): Promise<void>

  /**
   * Get the player's friends preferences (which controls whether the player
   * shows up in friend lists and whether invites are accepted).
   */
  getFriendsPreferences(user: UserProfile): Promise<MinecraftFriendsPreferences>

  /**
   * Update the player's friends preferences. Only the provided fields are
   * updated.
   */
  setFriendsPreferences(user: UserProfile, prefs: Partial<MinecraftFriendsPreferences>): Promise<MinecraftFriendsPreferences>
}

export const MinecraftFriendsServiceKey: ServiceKey<MinecraftFriendsService> = 'MinecraftFriendsService'

/**
 * The known sub-status codes the API returns inside `details.status` on 400
 * responses. Renderer code can use these to show user-friendly messages.
 */
export type MinecraftFriendsErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'rateLimited'
  | 'unavailable'
  | 'unknownProfile'
  | 'duplicatedProfile'
  | 'cannotAddSelf'
  | 'unsupported'
  | 'unknown'
