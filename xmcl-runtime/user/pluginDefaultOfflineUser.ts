import { AUTHORITY_DEV, UserProfile } from '@xmcl/runtime-api'
import { offline } from '@xmcl/user'
import { LauncherAppPlugin } from '~/app'
import { UserService } from './UserService'
import { kUserTokenStorage } from './userTokenStore'
import { getUUID } from './utils/offlineUser'
import { ImageStorage } from '~/infra'

const STEVE_SKIN_BASE64 = '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'

export const pluginDefaultOfflineUser: LauncherAppPlugin = async (app) => {
  const userService = await app.registry.get(UserService)
  const userTokenStorage = await app.registry.get(kUserTokenStorage)
  const imageStorage = await app.registry.get(ImageStorage)

  const state = await userService.getUserState()

  const hasUsers = Object.keys(state.users).length > 0

  if (!hasUsers) {
    const username = 'Steve'
    const auth = offline(username, getUUID(username))
    auth.selectedProfile.id = getUUID(username)

    const steveSkinBuffer = Buffer.from(STEVE_SKIN_BASE64, 'base64')
    const skinUrl = await imageStorage.addImage(steveSkinBuffer)

    const profile: UserProfile = {
      id: 'OFFLINE',
      invalidated: false,
      selectedProfile: auth.selectedProfile.id,
      profiles: {
        [auth.selectedProfile.id]: {
          name: username,
          id: auth.selectedProfile.id,
          uploadable: ['skin', 'cape'],
          textures: {
            SKIN: { url: skinUrl, metadata: { model: 'steve' } },
          },
        },
      },
      expiredAt: Number.MAX_SAFE_INTEGER / 100 * 95,
      authority: AUTHORITY_DEV,
      username: 'OFFLINE',
    }

    await userTokenStorage.put(profile, auth.accessToken)
    state.userProfile(profile)
    console.log('[pluginDefaultOfflineUser] Created default offline user: Steve with skin:', skinUrl)
  }
}