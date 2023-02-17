import { UserProfile, UserSchema } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
import { LauncherProfile } from '../entities/launchProfile'
import { loadYggdrasilApiProfile } from '../entities/user'
import { UserTokenStorage } from '../entities/userTokenStore'

/**
 * Fill the user data from loaded user data and loaded launcher profile json
 * @param output The output user data
 * @param input The loaded user data
 */
export async function preprocessUserData(output: UserSchema, input: UserSchema, minecraftJsonPath: string, tokenStorage: UserTokenStorage) {
  try {
    const minecraftProfile = await readFile(minecraftJsonPath, 'utf-8').then(JSON.parse).catch(() => undefined)
    fillData(output, input, minecraftProfile, tokenStorage)
  } catch {
    // Ignore
  }

  const checkToken = async (u: UserProfile) => {
    try {
      if ('accessToken' in u && typeof (u.accessToken) === 'string') {
        const t = await tokenStorage.get(u)
        if (!t) {
          await tokenStorage.put(u, (u as any).accessToken)
        }
      }
    } catch {
      // Ignore
    }
  }

  await Promise.all(Object.values(input.users).map(checkToken))
}
/**
 * Fit the user data from loaded user data and loaded launcher profile json
 */
function fillData(output: UserSchema, input: UserSchema, launchProfile: LauncherProfile | undefined, tokenStorage: UserTokenStorage) {
  output.clientToken = input.clientToken || launchProfile?.clientToken || randomUUID().replace(/-/g, '')
  output.selectedUser.id = input.selectedUser.id ?? output.selectedUser.id
  output.users = input.users
  output.selectedUser.id = input.selectedUser.id || launchProfile?.selectedUser?.account || ''

  for (const user of Object.values(output.users)) {
    if (typeof user.expiredAt === 'undefined') {
      user.expiredAt = -1
    }
  }

  // Fill the user data from minecraft launcher profile
  if (launchProfile?.clientToken === output.clientToken && launchProfile?.authenticationDatabase) {
    const adb = launchProfile.authenticationDatabase
    for (const userId of Object.keys(adb)) {
      const user = adb[userId]
      if (!output.users[userId]) {
        const profiles = Object.entries(user.profiles)
          .reduce((dict, [id, o]) => {
            dict[id] = {
              id,
              name: o.displayName,
              textures: { SKIN: { url: '' } },
            }
            return dict
          }, {} as { [key: string]: any })
        output.users[userId] = {
          id: userId,
          invalidated: false,
          username: user.username,
          authService: 'mojang',
          selectedProfile: profiles[launchProfile.selectedUser.profile] ? launchProfile.selectedUser.profile : Object.values(profiles)[0].id,
          expiredAt: 0,
          profiles,
        }
        tokenStorage.put(output.users[userId], user.accessToken)
      }
    }
  }
}
