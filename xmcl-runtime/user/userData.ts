import { isNotNull } from '@xmcl/core/utils'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, UserProfile, UserProfileCompatible, UserSchema, normalizeUserId } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs-extra'
import { join } from 'path'
import { LauncherProfile } from '~/launchProfile'
import { UserTokenStorage } from './userTokenStore'

/**
 * Fill the user data from loaded user data and loaded launcher profile json
 * @param output The output user data
 * @param input The loaded user data
 */
export async function preprocessUserData(output: Omit<UserSchema, 'users'> & { users: Record<string, UserProfile> }, input: UserSchema, minecraftJsonPath: string, tokenStorage: UserTokenStorage) {
  let mojangSelectedUserId = ''
  try {
    const minecraftProfile = await readFile(minecraftJsonPath, 'utf-8').then(JSON.parse).catch(() => undefined)
    fillData(output, input, minecraftProfile, tokenStorage)
    mojangSelectedUserId = minecraftProfile?.selectedUser?.account || ''
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

  const users = Object.values(input.users).map(migrateUserProfile)
    .filter(isNotNull)
    .map(userProfile => {
      userProfile.id = normalizeUserId(userProfile.id, userProfile.authority)
      return userProfile
    })

  await Promise.all(users.map(checkToken))

  output.users = users.reduce((acc, u) => {
    acc[u.id] = u
    return acc
  }, {} as Record<string, UserProfile>)

  return { mojangSelectedUserId }
}

function migrateUserProfile(userProfile: UserProfileCompatible): UserProfile | undefined {
  if (userProfile.authority) return userProfile as any
  if (userProfile.authService) {
    const output = {
      ...userProfile,
    }
    delete output.authService
    if (userProfile.authService === 'microsoft') {
      output.authority = AUTHORITY_MICROSOFT
    } else if (userProfile.authService === 'mojang') {
      output.authority = AUTHORITY_MOJANG
    } else if (userProfile.authService === 'offline') {
      output.authority = AUTHORITY_DEV
    } else if (userProfile.authService === 'littleskin.cn') {
      output.authority = 'https://littleskin.cn/api/yggdrasil'
    } else if (userProfile.authService === 'authserver.ely.by') {
      output.authority = 'https://authserver.ely.by/api/authlib-injector'
    } else {
      return undefined
    }
    return output as any
  }
  return undefined
}

/**
 * Fit the user data from loaded user data and loaded launcher profile json
 */
function fillData(output: Omit<UserSchema, 'users'> & { users: Record<string, UserProfile> }, input: UserSchema, launchProfile: LauncherProfile | undefined, tokenStorage: UserTokenStorage) {
  output.users = input.users as any

  for (const user of Object.values(output.users)) {
    if (typeof user.expiredAt === 'undefined') {
      user.expiredAt = -1
    }
  }

  // Fill the user data from minecraft launcher profile
  if (launchProfile?.authenticationDatabase) {
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
          authority: AUTHORITY_MICROSOFT,
          selectedProfile: profiles[launchProfile.selectedUser.profile] ? launchProfile.selectedUser.profile : Object.values(profiles)[0].id,
          expiredAt: 0,
          profiles,
        }
        tokenStorage.put(output.users[userId], user.accessToken)
      }
    }
  }
}

export async function ensureLauncherProfile(dir: string) {
  const profilePath = join(dir, 'launcher_profiles.json')
  if (existsSync(profilePath)) {
    return
  }

  const profile: LauncherProfile = {
    clientToken: '',
    profiles: {},
    selectedUser: {} as any,
    authenticationDatabase: {},
    settings: {},
  }

  // Create empty profile for install
  await writeFile(profilePath, JSON.stringify(profile, undefined, 2))
}
