import { offline } from '@xmcl/user'
import { LauncherAppPlugin } from '~/app'
import { UserService } from './UserService'
import { AUTHORITY_DEV, UserProfile } from '@xmcl/runtime-api'
import { kUserTokenStorage } from './userTokenStore'
import { ImageStorage } from '~/imageStore'
import { createHash } from 'crypto'

export const pluginOffineUser: LauncherAppPlugin = (app) => {
  const OFFLINE_USER_ID = 'OFFLINE'

  const getUUID = (input: string) => {
    input = `OfflinePlayer:${input}`
    const md5Bytes = createHash('md5').update(input).digest()
    md5Bytes[6] &= 0x0f /* clear version        */
    md5Bytes[6] |= 0x30 /* set to version 3     */
    md5Bytes[8] &= 0x3f /* clear variant        */
    md5Bytes[8] |= 0x80 /* set to IETF variant  */
    return md5Bytes.toString('hex').replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5')
  }
  app.on('engine-ready', async () => {
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
  })
}
