import { LauncherProfile } from '../services/UserService'
import { UserSchema } from '/@shared/entities/user.schema'
import { AUTH_API_MOJANG, PROFILE_API_MOJANG } from '@xmcl/user'
import { v4 } from 'uuid'

/**
 * Fit the user data from loaded user data and loaded launcher profile json
 */
export function fitMinecraftLauncherProfileData(result: UserSchema, data: UserSchema, launchProfile: LauncherProfile) {
  if (typeof data === 'object') {
    result.authServices = data.authServices
    result.authServices.mojang = AUTH_API_MOJANG

    result.profileServices = data.profileServices
    result.profileServices.mojang = PROFILE_API_MOJANG

    if (data.clientToken) {
      result.clientToken = data.clientToken
    } else {
      result.clientToken = launchProfile?.clientToken ?? v4().replace(/-/g, '')
    }

    if (data.selectedUser) {
      result.selectedUser.id = data.selectedUser.id ?? result.selectedUser.id
      result.selectedUser.profile = data.selectedUser.profile ?? result.selectedUser.profile
    }
    result.users = data.users
  } else {
    // import mojang authDB
    result.clientToken = launchProfile?.clientToken ?? v4().replace(/-/g, '')
    result.authServices = { mojang: AUTH_API_MOJANG }
    result.profileServices = { mojang: PROFILE_API_MOJANG }

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
