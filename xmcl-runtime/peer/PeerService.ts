import { DownloadTask } from '@xmcl/installer'
import { PeerService as IPeerService, MutableState, PeerServiceKey, PeerState, ShareInstanceOptions } from '@xmcl/runtime-api'
import { Inject, LauncherApp, LauncherAppKey, kGameDataPath } from '~/app'
import { ExposeServiceKey, ServiceStateManager, StatefulService } from '~/service'
import { kPeerFacade } from './PeerServiceFacade'
import { kClientToken } from '~/clientToken'

@ExposeServiceKey(PeerServiceKey)
export class PeerService extends StatefulService<PeerState> implements IPeerService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
  ) {
    super(app, () => store.registerStatic(new PeerState(), PeerServiceKey), async () => { })

    let port = 25566
    app.controller.handle('multiplayer-port', async (ev, p: number) => {
      port = p
    })
    app.controller.handle('multiplayer-init', async () => {
      const resourcePath = (await app.registry.get(kGameDataPath))()
      const sessionId = await app.registry.get(kClientToken)
      return {
        appDataPath: app.appDataPath,
        resourcePath,
        sessionId,
      }
    })

    const queryGameProfile = async (name: string) => {
      return this.state.connections.find(c => c.userInfo.name === name || c.userInfo.id === name)?.userInfo
    }
    app.registry.register(kPeerFacade, {
      queryGameProfile,
      getHttpDownloadUrl(url) {
        const peerUrl = new URL(url)
        if (peerUrl.protocol !== 'peer:') {
          throw new Error(`Bad url: ${url}`)
        }

        const realUrl = `http://localhost:${port}/files/${peerUrl.host}?path=${peerUrl.pathname}`

        return realUrl
      },
    })
  }

  async getPeerState(): Promise<MutableState<PeerState>> {
    return this.state
  }

  async shareInstance(options: ShareInstanceOptions): Promise<void> {
    this.app.controller.broadcast('peer-instance-shared', options)
  }

  async exposePort(port: number, protocol: number): Promise<void> {
    if (this.state.exposedPorts.some(([p]) => p === port)) {
      return
    }
    this.state.exposedPortsSet([...this.state.exposedPorts, [port, protocol]])
  }

  async unexposePort(port: number): Promise<void> {
    this.state.exposedPortsSet(this.state.exposedPorts.filter(([p]) => p !== port))
  }
}
