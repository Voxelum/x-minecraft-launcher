import { OfflineUserService as IOfflineUserService, OfflineUserServiceKey, UserProfile } from '@xmcl/runtime-api'
import { offline } from '@xmcl/user'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { kUserTokenStorage, UserTokenStorage } from '../entities/userTokenStore'
import { ImageStorage } from '../util/imageStore'
import { Inject } from '../util/objectRegistry'
import { AbstractService, ExposeServiceKey } from './Service'
import { UserService } from './UserService'

const OFFLINE_USER_ID = 'OFFLINE'

@ExposeServiceKey(OfflineUserServiceKey)
export class OfflineUserService extends AbstractService implements IOfflineUserService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ImageStorage) readonly imageStore: ImageStorage,
    @Inject(UserService) private userService: UserService,
    @Inject(kUserTokenStorage) userTokenStorage: UserTokenStorage,
  ) {
    super(app, async () => {
      await userService.initialize()

      userService.registerAccountSystem('offline', {
        getYggdrasilHost: () => {
          const address = app.server.address()
          if (address) {
            if (typeof address === 'string') {
              return `http://localhost${address.substring(address.indexOf(':'))}/yggdrasil`
            }
            return `http://localhost:${address.port}/yggdrasil`
          }
          this.error(`Unexpected state. The OfflineYggdrasilServer does not initialized? Listening: ${app.server.listening}`)
          return ''
        },
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
            profiles: profiles,
            expiredAt: Number.MAX_SAFE_INTEGER / 100 * 95,
            authService: 'offline',
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

  async isAllowed(): Promise<boolean> {
    return Object.values(this.userService.state.users).some(u => u.authService === 'microsoft')
  }

  async removeGameProfile(name: string): Promise<void> {
    const builtin = this.userService.state.users[OFFLINE_USER_ID]
    if (builtin) {
      const profile = Object.values(builtin.profiles).find(v => v.name === name || v.id === name)
      if (profile) {
        delete builtin.profiles[profile.id]
        if (profile?.id === builtin.selectedProfile) {
          builtin.selectedProfile = Object.values(builtin.profiles)[0].id
        }
      }
    }
    this.userService.state.userProfile(builtin)
  }
}
