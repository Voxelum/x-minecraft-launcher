import { UserSchema } from '@xmcl/runtime-api'
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
    }
    result.users = data.users
  } else {
    // import mojang authDB
    result.clientToken = launchProfile?.clientToken ?? randomUUID().replace(/-/g, '')

    if (launchProfile.selectedUser) {
      result.selectedUser.id = launchProfile.selectedUser.account
    }
  }
  if (launchProfile?.clientToken === result.clientToken && launchProfile.authenticationDatabase) {
    const adb = launchProfile.authenticationDatabase
    for (const userId of Object.keys(adb)) {
      const user = adb[userId]
      if (!result.users[userId]) {
        const profiles = Object.entries(user.profiles)
          .reduce((dict, [id, o]) => {
            dict[id] = {
              id,
              name: o.displayName,
              textures: { SKIN: { url: '' } },
            }
            return dict
          }, {} as { [key: string]: any })
        result.users[userId] = {
          id: userId,
          username: user.username,
          accessToken: user.accessToken,
          authService: 'mojang',
          selectedProfile: profiles[launchProfile.selectedUser.profile] ? launchProfile.selectedUser.profile : Object.values(profiles)[0].id,
          expiredAt: 0,
          profiles,
        }
      }
    }
  }
}
