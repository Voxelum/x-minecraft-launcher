import { AUTHORITY_DEV, UserProfile } from '@xmcl/runtime-api'
import { offline } from '@xmcl/user'
import { LauncherAppPlugin } from '~/app'
import { ImageStorage } from '~/imageStore'
import { getUUID } from '~/util/offlineUser'
import { UserService } from './UserService'
import { kUserTokenStorage } from './userTokenStore'

export const pluginOffineUser: LauncherAppPlugin = async (app) => {
  const OFFLINE_USER_ID = 'OFFLINE'

  const userService = await app.registry.get(UserService)
  const userTokenStorage = await app.registry.get(kUserTokenStorage)
  const imageStore = await app.registry.get(ImageStorage)
  userService.getUserState().then((state) => {
    const offlineUsers = state.users[OFFLINE_USER_ID]
    if (offlineUsers) {
      let modified = false
      for (const [k, v] of Object.entries(offlineUsers.profiles)) {
        const expectedUUID = getUUID(v.name)
        if (k !== expectedUUID) {
          modified = true
          v.id = expectedUUID
          delete offlineUsers.profiles[k]
          offlineUsers.profiles[expectedUUID] = v
        }
      }
      if (modified) {
        state.userProfile(offlineUsers)
      }
    }
  })
  userService.registerAccountSystem(AUTHORITY_DEV, {
    async login({ username, properties }) {
      const auth = offline(username, properties?.uuid)
      auth.selectedProfile.id = getUUID(username)

      const existed = userService.state.users[OFFLINE_USER_ID]
      const profiles = existed ? { ...existed.profiles } : {}
      for (const p of auth.availableProfiles) {
        profiles[p.id] = {
          name: p.name,
          id: p.id,
          uploadable: ['cape', 'skin'],
          textures: {
            SKIN: {
              url: '',
              metadata: {},
            },
          },
        }
      }

      const profile: UserProfile = {
        id: OFFLINE_USER_ID,
        invalidated: false,
        selectedProfile: auth.selectedProfile.id,
        profiles,
        expiredAt: Number.MAX_SAFE_INTEGER / 100 * 95,
        authority: AUTHORITY_DEV,
        username: OFFLINE_USER_ID,
      }
      await userTokenStorage.put(profile, auth.accessToken)

      return profile
    },
    async setSkin(p, gameProfile, { skin, cape }) {
      if (skin !== undefined) {
        if (skin) {
          let url = skin.url
          if (!url.startsWith('http')) {
            url = await imageStore.addImage(url)
          }
          gameProfile.textures.SKIN.url = url
          gameProfile.textures.SKIN.metadata = { model: skin.slim ? 'slim' : 'steve' }
        } else {
          gameProfile.textures.SKIN.url = ''
          gameProfile.textures.SKIN.metadata = undefined
        }
      }
      if (cape !== undefined) {
        if (cape) {
          let url = cape
          if (!url.startsWith('http')) {
            url = await imageStore.addImage(url)
          }
          gameProfile.textures.CAPE = { url }
        } else {
          gameProfile.textures.CAPE = undefined
        }
      }
      return p
    },
    async refresh(p) { return p },
  })
}
