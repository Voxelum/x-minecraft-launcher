import { UserSchema } from '@xmcl/runtime-api'
import { AUTH_API_MOJANG, PROFILE_API_MOJANG } from '@xmcl/user'
import { randomUUID } from 'crypto'
import { LauncherProfile } from '../entities/launchProfile'

/**
 * Fit the user data from loaded user data and loaded launcher profile json
 */
export function fitMinecraftLauncherProfileData(result: UserSchema, data: UserSchema, launchProfile: LauncherProfile) {
  if (typeof data === 'object') {
    if (data.clientToken) {
      result.clientToken = data.clientToken
    } else {
      result.clientToken = launchProfile?.clientToken ?? randomUUID().replace(/-/g, '')
    }

    if (data.selectedUser) {
      result.selectedUser.id = data.selectedUser.id ?? result.selectedUser.id
      result.selectedUser.profile = data.selectedUser.profile ?? result.selectedUser.profile
    }
    result.users = data.users
  } else {
    // import mojang authDB
    result.clientToken = launchProfile?.clientToken ?? randomUUID().replace(/-/g, '')

    if (launchProfile.selectedUser) {
      result.selectedUser.id = launchProfile.selectedUser.account
      result.selectedUser.profile = launchProfile.selectedUser.profile
    }
  }
  if (launchProfile?.clientToken === result.clientToken && launchProfile.authenticationDatabase) {
    const adb = launchProfile.authenticationDatabase
    for (const userId of Object.keys(adb)) {
      const user = adb[userId]
      if (!result.users[userId]) {
        result.users[userId] = {
          id: userId,
          username: user.username,
          accessToken: user.accessToken,
          authService: 'mojang',
          profileService: 'mojang',
          selectedProfile: '',
          expiredAt: 0,
          profiles: Object.entries(user.profiles)
            .reduce((dict, [id, o]) => {
              dict[id] = {
                id,
                name: o.displayName,
                textures: { SKIN: { url: '' } },
              }
              return dict
            }, {} as { [key: string]: any }),
        }
      }
    }
  }
}
