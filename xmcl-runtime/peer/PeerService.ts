import {
  PeerService as IPeerService,
  SharedState,
  PeerServiceKey,
  PeerState,
  ShareInstanceOptions,
} from '@xmcl/runtime-api'
import { Inject, LauncherApp, LauncherAppKey, kGameDataPath } from '~/app'
import { ExposeServiceKey, ServiceStateManager, StatefulService } from '~/service'
import { kPeerFacade } from './PeerServiceFacade'
import { kClientToken, kFlights } from '~/infra'
import { kXmclSessionAuthorization, XmclAccountService } from '~/xmclAccount/XmclAccountService'
import { resolveXmclApiBaseUrl } from '~/app/xmclApiBaseUrl'
import type { MultiplayerIceServerCredential, MultiplayerRoomAdmission } from '@xmcl/runtime-api'
import { UserService } from '~/user'

@ExposeServiceKey(PeerServiceKey)
export class PeerService extends StatefulService<PeerState> implements IPeerService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
  ) {
    super(
      app,
      () => store.registerStatic(new PeerState(), PeerServiceKey),
      async () => {},
    )

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
    const getMultiplayerApiBaseUrl = async () => {
      const flights = await app.registry.get(kFlights)
      return resolveXmclApiBaseUrl(flights.xmclApiBaseUrl, app.getLogger('MultiplayerApi'))
    }
    const requestRoom = async (
      path: string,
      init: RequestInit,
    ): Promise<MultiplayerRoomAdmission | undefined> => {
      const account = await app.registry.get(XmclAccountService)
      const authorization = await account[kXmclSessionAuthorization]()
      if (!authorization) throw new Error('xmcl_account_session_missing')
      const multiplayerApiBaseUrl = await getMultiplayerApiBaseUrl()
      const headers = new Headers(init.headers)
      headers.set('Content-Type', 'application/json')
      headers.set('authorization', ['Bearer', authorization.accessToken].join(' '))
      const response = await app.fetch(new URL(path, multiplayerApiBaseUrl), {
        ...init,
        headers,
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message || `multiplayer_room_request_failed:${response.status}`)
      }
      if (response.status === 204) return undefined
      const admission = (await response.json()) as MultiplayerRoomAdmission
      const socketUrl = new URL(admission.socketUrl, multiplayerApiBaseUrl)
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      return { ...admission, socketUrl: socketUrl.toString() }
    }
    app.controller.handle(
      'multiplayer-room-create',
      async (_event, input: { displayName: string; maxPeers?: number }) => {
        const admission = await requestRoom('/v2/multiplayer/rooms', {
          method: 'POST',
          body: JSON.stringify(input),
        })
        return admission && { ...admission, role: 'host' as const }
      },
    )
    app.controller.handle(
      'multiplayer-room-join',
      async (_event, input: { roomId: string; displayName: string }) => {
        const admission = await requestRoom(
          `/v2/multiplayer/rooms/${encodeURIComponent(input.roomId)}/join`,
          {
            method: 'POST',
            body: JSON.stringify({ displayName: input.displayName }),
          },
        )
        return admission && { ...admission, role: 'guest' as const }
      },
    )
    app.controller.handle('multiplayer-room-close', async (_event, roomId: string) => {
      await requestRoom(`/v2/multiplayer/rooms/${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
      })
    })
    app.controller.handle(
      'multiplayer-ice-servers',
      async (): Promise<MultiplayerIceServerCredential> => {
        const multiplayerApiBaseUrl = await getMultiplayerApiBaseUrl()
        const official = await app.registry
          .get(UserService)
          .then((service) => service.getOfficialUserProfile())
        const headers = new Headers()
        if (official?.accessToken) {
          headers.set('authorization', ['Bearer', official.accessToken].join(' '))
        }
        const response = await app.fetch(new URL('/rtc/official', multiplayerApiBaseUrl), {
          method: 'POST',
          headers,
        })
        if (!response.ok) {
          throw new Error(`multiplayer_ice_server_request_failed:${response.status}`)
        }
        return (await response.json()) as MultiplayerIceServerCredential
      },
    )

    const queryGameProfile = async (name: string) => {
      return this.state.connections.find((c) => c.userInfo.name === name || c.userInfo.id === name)
        ?.userInfo
    }

    app.registry.register(kPeerFacade, {
      queryGameProfile,
      getHttpDownloadUrl(url) {
        const peerUrl = new URL(url)
        if (peerUrl.protocol !== 'peer:') {
          throw new Error(`Bad url: ${url}`)
        }

        const orignalFilePath = decodeURI(peerUrl.pathname)
        const urlBase64 = Buffer.from(orignalFilePath).toString('base64url')

        const realUrl = new URL(
          `http://localhost:${port}/files/${peerUrl.host}?path=${urlBase64}`,
        ).toString()

        return realUrl
      },
    })
  }

  async getPeerState(): Promise<SharedState<PeerState>> {
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
