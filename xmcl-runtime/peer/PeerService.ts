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
      createDownloadTask(url: string, destination: string, sha1: string, size?: number) {
        const peerUrl = new URL(url)
        if (peerUrl.protocol !== 'peer:') {
          throw new Error(`Bad url: ${url}`)
        }

        const realUrl = `http://localhost:${port}/files/${peerUrl.host}?path=${peerUrl.pathname}`

        return new DownloadTask({
          url: realUrl,
          destination,
          skipHead: true,
          validator: {
            algorithm: 'sha1',
            hash: sha1,
          },
        })
      },
    })
  }

  async getPeerState(): Promise<MutableState<PeerState>> {
    return this.state
  }

  async shareInstance(options: ShareInstanceOptions): Promise<void> {
    this.app.controller.broadcast('peer-instance-shared', options)
  }
}
