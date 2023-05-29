import { offline } from '@xmcl/user'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { UserService } from '../services/UserService'
import { AUTHORITY_DEV, UserProfile } from '@xmcl/runtime-api'
import { kUserTokenStorage } from '../entities/userTokenStore'
import { ImageStorage } from '../util/imageStore'

export const pluginOffineUser: LauncherAppPlugin = (app) => {
  const OFFLINE_USER_ID = 'OFFLINE'
  app.on('engine-ready', async () => {
    const userService = await app.registry.get(UserService)
    const userTokenStorage = await app.registry.get(kUserTokenStorage)
    const imageStore = await app.registry.get(ImageStorage)
    userService.registerAccountSystem(AUTHORITY_DEV, {
      async login({ username, properties }) {
        const auth = offline(username, properties?.uuid)
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
              // let u = url
              // if (u.startsWith('image://')) {
              //   u = url.substring('image://'.length)
              // }
              // url = `data:image/png;base64,${await readFile(u, 'base64')}`
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
              // let u = url
              // if (u.startsWith('image://')) {
              //   u = url.substring('image://'.length)
              // }
              // url = `data:image/png;base64,${await readFile(u, 'base64')}`
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
