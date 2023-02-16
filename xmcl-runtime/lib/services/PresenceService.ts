import { Client, SetActivity } from '@xmcl/discord-rpc'
import { PresenceService as IPresenceService, PresenceServiceKey, Activity } from '@xmcl/runtime-api'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { BaseService } from './BaseService'
import { PeerService } from './PeerService'
import { AbstractService, ExposeServiceKey } from './Service'

@ExposeServiceKey(PresenceServiceKey)
export class PresenceService extends AbstractService implements IPresenceService {
  private discord: Client
  private current: SetActivity = {
  }

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) baseService: BaseService) {
    super(app, async () => {
      if (baseService.state.discordPresence) {
        await this.discord.connect()
        this.discord.subscribe('ACTIVITY_JOIN')
        this.discord.subscribe('ACTIVITY_JOIN_REQUEST')
        this.discord.subscribe('ACTIVITY_INVITE')
        this.discord.on('ACTIVITY_JOIN', (arg) => {
          console.log('ACTIVITY_JOIN')
          console.log(arg)
        })
        this.discord.on('ACTIVITY_JOIN_REQUEST', (arg) => {
          console.log('ACTIVITY_JOIN_REQUEST')
          console.log(arg)
        })
        this.discord.on('ACTIVITY_JOIN', (arg) => {
          console.log('ACTIVITY_JOIN')
          console.log(arg)
        })
      }
    })

    app.serviceStateManager.subscribe('discordPresenceSet', async (state) => {
      if (state) {
        await this.discord.connect()
      } else {
        await this.discord.destroy()
      }
    }).subscribe('connectionGroup', (id) => {
      if (this.discord.isConnected) {
        this.current.state = id ? 'Group ' + id : ''
        this.current.partyId = id || undefined
        if (id) {
          this.current.partyMax = 20
          this.current.partySize = 1
        } else {
          this.current.partyMax = undefined
          this.current.partySize = undefined
        }
        this.current.joinSecret = id ? id + 'secret' : undefined
        this.discord.user?.setActivity(this.current)
      }
    }).subscribe('connectionAdd', () => {
      this.current.partySize = (this.current.partySize || 1) + 1
      this.discord.user?.setActivity(this.current)
    }).subscribe('connectionDrop', () => {
      this.current.partySize = (this.current.partySize || 1) - 1
      this.discord.user?.setActivity(this.current)
    })

    this.discord = new Client({
      clientId: '1075044884400054363',
    })
  }

  async setActivity(activity: Activity): Promise<void> {
    if (!this.discord.isConnected) {
      await this.discord.connect()
    }
    const param = this.current
    this.current.largeImageKey = 'dark_512'
    this.current.startTimestamp = Date.now()
    switch (activity.location) {
      case 'modrinth':
        param.details = 'Viewing Modrinth'
        break
      case 'curseforge':
        param.details = 'Viewing CurseForge'
        break
      case 'modpack':
        param.details = 'Viewing Modpacks'
        break
      case 'setting':
        param.details = 'Viewing Setting Page'
        break
      case 'user':
        param.details = 'Viewing User Page'
        break
      case 'versions':
        param.details = 'Viewing Versions Page'
        break
      case 'modrinth-project':
        param.details = `Viewing ${activity.name} in Modrinth`
        break
      case 'curseforge-project':
        param.details = `Viewing ${activity.name} in Curseforge`
        break
      case 'instance-mods':
        param.details = 'Viewing Mods in ' + activity.instance
        break
      case 'instance-setting':
        param.details = 'Viewing Settings in ' + activity.instance
        break
      case 'instance-saves':
        param.details = 'Viewing Saves in ' + activity.instance
        break
      case 'instance-resourcepacks':
        param.details = 'Viewing Resource Packs in ' + activity.instance
        break
      case 'instance-shaderpacks':
        param.details = 'Viewing Shader Packs in ' + activity.instance
        break
      case 'instance':
        param.details = 'Idle in Instance ' + activity.instance
        break
    }
    await this.discord.user?.setActivity(param)
  }
}
