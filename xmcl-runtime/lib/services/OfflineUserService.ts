import { OfflineUserService as IOfflineUserService, OfflineUserServiceKey, UserProfile } from '@xmcl/runtime-api'
import { GameProfile, offline } from '@xmcl/user'
import { Server } from 'http'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { createOfflineYggdrasilServer } from '../servers/YggdrasilServer'
import { Inject } from '../util/objectRegistry'
import { offlineModeDenylist } from '../util/offlineModeDenylist'
import { AbstractService, ExposeServiceKey } from './Service'
import { UserService } from './UserService'

const OFFLINE_USER_ID = 'OFFLINE'

@ExposeServiceKey(OfflineUserServiceKey)
export class OfflineUserService extends AbstractService implements IOfflineUserService {
  private _isAllowed = false
  private server: Server | undefined

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app, OfflineUserServiceKey, async () => {
      await userService.initialize()

      const code = app.getLocaleCountryCode()

      this._isAllowed = offlineModeDenylist.indexOf(code.toUpperCase()) === -1
      this._isAllowed = true
      if (this._isAllowed) {
        const server = await createOfflineYggdrasilServer((name) => {
          const offline = userService.state.users[OFFLINE_USER_ID]
          if (offline) {
            const profiles = Object.values(offline.profiles)
            const founded = profiles.find(p => p.name === name || p.id === name || p.id.replaceAll('-', '') === name)
            if (founded) {
              return founded
            }
          }
          return undefined
        })

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
              expiredAt: 0,
              authService: 'offline',
              username: OFFLINE_USER_ID,
            }
            return profile
          },
          async setSkin(p, gameProfile, { skin, cape }) {
            if (skin !== undefined) {
              if (skin) {
                gameProfile.textures.SKIN.url = skin.url
                gameProfile.textures.SKIN.metadata = { model: skin.slim ? 'slim' : 'steve' }
              } else {
                gameProfile.textures.SKIN.url = ''
                gameProfile.textures.SKIN.metadata = undefined
              }
            }
            if (cape !== undefined) {
              if (cape) {
                gameProfile.textures.CAPE = { url: cape }
              } else {
                gameProfile.textures.CAPE = undefined
              }
            }
            return p
          },
          async getSkin(p) { return p },
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
      const profileId = Object.values(builtin.profiles).find(v => v.name === name || v.id === name)?.id
      if (profileId) {
        delete builtin.profiles[profileId]
      }
    }
    this.userService.state.userProfile(builtin)
  }

  async dispose(): Promise<void> {
    this.server?.close()
    this.server = undefined
  }
}
