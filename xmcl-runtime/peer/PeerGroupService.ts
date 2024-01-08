import { GameProfileAndTexture, PeerGroupService as IPeerGroupService, MutableState, PeerService as IPeerService, PeerGroupServiceKey, PeerGroupState } from '@xmcl/runtime-api'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { ExposeServiceKey, Lock, ServiceStateManager, StatefulService } from '~/service'
import { PeerGroup } from './PeerGroupUndici'
import { PeerService } from './PeerService'
import { randomUUID } from 'crypto'

@ExposeServiceKey(PeerGroupServiceKey)
export class PeerGroupService extends StatefulService<PeerGroupState> implements IPeerGroupService {
  private group: PeerGroup | undefined

  /**
   * The unique id of this host.
   */
  private id = randomUUID()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(PeerService) private peerService: PeerService,
  ) {
    super(app, () => store.registerStatic(new PeerGroupState(), PeerGroupServiceKey))

    app.protocol.registerHandler('xmcl', ({ request, response }) => {
      const parsed = request.url
      if (parsed.host === 'launcher' && parsed.pathname === '/peer') {
        const params = parsed.searchParams
        const group = params.get('group')

        if (!group) {
          this.warn(`Ignore illegal peer join for group=${group}`)
          response.status = 400
        } else {
          this.joinGroup(group)
          response.status = 200
        }
      }
    });

    (peerService as IPeerService).on('connection-local-description', ({ description, type }) => {
      this.group?.sendLocalDescription(description.id, description.sdp, type as any, description.candidates)
    })
  }

  async getGroupState(): Promise<MutableState<PeerGroupState>> {
    return this.state
  }

  @Lock('joinGroup')
  async joinGroup(groupId: string, gameProfile?: GameProfileAndTexture): Promise<void> {
    if (this.group?.groupId && this.group.groupId === groupId) {
      return
    }

    if (this.group) {
      this.group.quit()
    }

    const group = new PeerGroup(groupId, this.id)

    group.on('heartbeat', (sender) => {
      const peer = Object.values(this.peerService.peers).find(p => p.getRemoteId() === sender)
      // Ask sender to connect to me :)
      if (!peer) {
        if (this.id.localeCompare(sender) > 0) {
          this.log(`Not found the ${sender}. Initiate new connection`)
          // Only if my id is greater than other's id, we try to initiate the connection.
          // This will have a total order in the UUID random space

          // Try to connect to the sender
          this.peerService.initiate({ remoteId: sender, initiate: true, gameProfile })
        }
      }
    })
    group.on('descriptor', async (sender, sdp, type, candidates) => {
      this.peerService.setRemoteDescription({
        description: {
          id: sender,
          session: '',
          sdp,
          candidates,
        },
        type: type as any,
        gameProfile,
      })
    })
    group.on('state', (state) => {
      this.state.connectionGroupState(state)
      this.emit('connection-group-state', state)
    })
    group.on('error', (err) => {
      if (err instanceof Error) this.error(err)
    })

    this.group = group
    this.state.connectionGroup(group.groupId)
    this.state.connectionGroupState(group.state)
    this.emit('connection-group', group.groupId)
    this.emit('connection-group-state', group.state)
  }

  async leaveGroup(): Promise<void> {
    this.group?.quit()
    this.group = undefined
    this.state.connectionGroup('')
    this.state.connectionGroupState('closed')
    this.emit('connection-group', '')
    this.emit('connection-group-state', 'closed')
  }
}
