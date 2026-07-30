import { MinecraftFriendsException } from '@xmcl/runtime-api'
import { MojangFriendsError } from '@xmcl/user'

const subStatusReasons = {
  UNKNOWN_PROFILE: 'UNKNOWN_PROFILE',
  DUPLICATED_PROFILES: 'DUPLICATED_PROFILES',
  CANNOT_ADD_SELF: 'CANNOT_ADD_SELF',
  INVITE_REJECTED: 'INVITE_REJECTED',
} as const

export function translateMojangFriendsError(error: unknown): unknown {
  if (!(error instanceof MojangFriendsError)) return error

  const subStatus = error.subStatus as keyof typeof subStatusReasons | undefined
  const reason = (subStatus ? subStatusReasons[subStatus] : undefined)
    ?? (error.status === 403 || /friends enabled or accept invites/i.test(error.message)
      ? 'FRIENDS_DISABLED'
      : /name or profile does not exist/i.test(error.message)
        ? 'UNKNOWN_PROFILE'
        : /size must be between 3 and 16/i.test(error.message)
          ? 'INVALID_NAME'
          : undefined)

  return reason
    ? new MinecraftFriendsException({ type: 'minecraftFriends', reason }, error.message, { cause: error })
    : error
}
