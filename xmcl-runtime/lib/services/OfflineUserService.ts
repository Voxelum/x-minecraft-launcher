import { OfflineUserService as IOfflineUserService, OfflineUserServiceKey, UserProfile } from '@xmcl/runtime-api'
import { GameProfile, offline } from '@xmcl/user'
import { Server } from 'http'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { createOfflineYggdrasilServer } from '../servers/YggdrasilServer'
import { Inject } from '../util/objectRegistry'
import { offlineModeDenylist } from '../util/offlineModeDenylist'
import { AbstractService, ExposeServiceKey } from './Service'
import { PeerService } from './PeerService'
import { UserService } from './UserService'
import { ImageStorage } from '../util/imageStore'

const OFFLINE_USER_ID = 'OFFLINE'

@ExposeServiceKey(OfflineUserServiceKey)
export class OfflineUserService extends AbstractService implements IOfflineUserService {
  private _isAllowed = false
  private server: Server | undefined

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ImageStorage) readonly imageStore: ImageStorage,
    @Inject(PeerService) private peerService: PeerService,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app, OfflineUserServiceKey, async () => {
      await userService.initialize()

      const code = app.getLocaleCountryCode()

      this._isAllowed = offlineModeDenylist.indexOf(code.toUpperCase()) === -1
      this._isAllowed = true
      if (this._isAllowed) {
        const server = createOfflineYggdrasilServer(async (name) => {
          const offline = userService.state.users[OFFLINE_USER_ID]
          if (offline) {
            const profiles = Object.values(offline.profiles)
            const founded = profiles.find(p => p.name === name || p.id === name || p.id.replaceAll('-', '') === name)
            if (founded) {
              return founded
            }
          }
          const founded = peerService.state.connections.map(c => c.userInfo).find(c => c.id === name || c.name === name)
          if (founded) {
            return founded
          }
          return undefined
        }, imageStore.root)

        await new Promise<void>((resolve) => {
          server.listen(undefined, () => { resolve() })
        })

        userService.registerAccountSystem('offline', {
          getYggdrasilHost() {
            return `http://localhost:${(server.address() as any).port}`
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
              accessToken: existed?.accessToken ?? auth.accessToken,
              selectedProfile: auth.selectedProfile.id,
              profiles: profiles,
              expiredAt: Number.MAX_SAFE_INTEGER / 100 * 95,
              authService: 'offline',
              username: OFFLINE_USER_ID,
            }
            return profile
          },
          async setSkin(p, gameProfile, { skin, cape }) {
            if (skin !== undefined) {
              if (skin) {
                let url = skin.url
                console.log(url)
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
        this.server = server
      }
    })
  }

  async isAllowed(): Promise<boolean> {
    return this._isAllowed
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

  async dispose(): Promise<void> {
    this.server?.close()
    this.server = undefined
  }
}
