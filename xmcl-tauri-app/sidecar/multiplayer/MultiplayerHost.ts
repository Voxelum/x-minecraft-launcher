import {
  MultiplayerIceServerCredential,
  MultiplayerRoomAdmission,
  PeerState,
  SharedState,
  UserState,
} from '@xmcl/runtime-api'
import type { LauncherApp } from '@xmcl/runtime/app'
import type { Logger } from '@xmcl/runtime/infra'
import { PeerService } from '@xmcl/runtime/peer'
import { UserService } from '@xmcl/runtime/user'
import { createMultiplayer, listen } from '@xmcl/wrtc-multiplayer'
import { Readable } from 'stream'
import { BridgeServer } from '../bridge/BridgeServer'

/**
 * The peer mesh, running inside the sidecar.
 *
 * Electron kept it in the preload of the multiplayer window, which is a Node
 * context with `node-datachannel` available. WebKitGTK ships no
 * `RTCPeerConnection` on Linux and its webview cannot load native modules, so
 * the exact same `@xmcl/wrtc-multiplayer` peer runs here instead and the window
 * only drives it: `preload/multiplayer.ts` rebuilds the `multiplayer` global on
 * top of the `multiplayer-call` channel and the `multiplayer-event` broadcast.
 *
 * Talking to the runtime is simpler than it was in the preload, because both
 * now live in this process: the peer mutates the real `PeerState` instead of a
 * state proxied over IPC, and the room API goes through
 * `app.protocol.handle`, which is what authenticated the preload's `fetch` in
 * Electron (`ElectronSession` routed every request into it).
 */
export class MultiplayerHost {
  private peer: ReturnType<typeof createMultiplayer> | undefined
  private starting: Promise<void> | undefined
  private inited = false
  private stateReady = false
  private signalingBaseUrl = ''
  private readonly settings = new Map<string, string>()
  private iceRefreshTimer: ReturnType<typeof setTimeout> | undefined

  /** Every `multiplayer` method the renderer is allowed to reach. */
  private static readonly CALLABLE = [
    'refreshNat',
    'setUserInfo',
    'initiate',
    'setRemoteDescription',
    'drop',
    'createGroup',
    'joinGroup',
    'transferGroupMaster',
    'leaveGroup',
    'shareInstance',
    'getNatDeviceInfo',
    'isNatSupported',
  ] as const

  constructor(
    private readonly app: LauncherApp,
    private readonly bridge: BridgeServer,
    private readonly logger: Logger,
  ) {
    bridge.handle('multiplayer-ready', () => this.inited && this.stateReady)
    bridge.handle('multiplayer-call', (_, method: string, args: unknown[]) =>
      this.call(method, args ?? []),
    )
    bridge.handle('multiplayer-settings', (_, settings: Record<string, string | null>) => {
      for (const [key, value] of Object.entries(settings ?? {})) {
        if (value === null) this.settings.delete(key)
        else this.settings.set(key, value)
      }
    })
  }

  /**
   * `@xmcl/wrtc-multiplayer` reads the kernel and TURN preferences from
   * `localStorage`, which existed because Electron ran it in the renderer
   * context of the multiplayer window. The window now mirrors those keys here
   * through `multiplayer-settings`.
   */
  private installSettingsStorage() {
    if ('localStorage' in globalThis) return
    const settings = this.settings
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        get length() {
          return settings.size
        },
        key: (index: number) => [...settings.keys()][index] ?? null,
        getItem: (key: string) => settings.get(key) ?? null,
        setItem: (key: string, value: string) => void settings.set(key, String(value)),
        removeItem: (key: string) => void settings.delete(key),
        clear: () => settings.clear(),
      } satisfies Storage,
    })
  }

  /**
   * Boot the peer. Called when the multiplayer window opens, mirroring Electron,
   * where creating that window is what loaded the preload.
   */
  start() {
    this.starting ??= this.doStart().catch((e) => {
      this.starting = undefined
      this.logger.error(e as Error)
      throw e
    })
    return this.starting
  }

  private async call(method: string, args: unknown[]) {
    if (!(MultiplayerHost.CALLABLE as readonly string[]).includes(method)) {
      throw new Error(`multiplayer_unknown_method:${method}`)
    }
    await this.start()
    const peer = this.peer as unknown as Record<string, (...a: unknown[]) => unknown>
    return await peer[method](...args)
  }

  private async doStart() {
    this.installSettingsStorage()
    const { appDataPath, resourcePath, sessionId, signalingBaseUrl } = await this.getInitPayload()
    this.signalingBaseUrl = signalingBaseUrl

    const peer = createMultiplayer({
      createRoom: async (displayName, maxPeers) =>
        this.parseAdmission(
          await this.request('/v1/multiplayer/rooms', 'POST', { displayName, maxPeers }),
        ),
      joinRoom: async (roomId, displayName, createIfMissing) =>
        this.parseAdmission(
          await this.request(
            `/v1/multiplayer/rooms/${encodeURIComponent(roomId)}/join`,
            'POST',
            { displayName, createIfMissing },
          ),
        ),
      closeRoom: async (roomId) => {
        await this.request(`/v1/multiplayer/rooms/${encodeURIComponent(roomId)}`, 'DELETE')
      },
      getIceServerCredential: async () =>
        (await this.request('/v1/rtc/official', 'POST')) as MultiplayerIceServerCredential,
    })
    this.peer = peer

    this.logger.log(`Starting the peer mesh in the sidecar. appData=${appDataPath}`)
    peer.init(appDataPath, resourcePath, sessionId)
    peer.emitter.emit('ready')
    this.inited = true

    // The renderer listens through `multiplayer-event`; only the multiplayer
    // window has the global that consumes it, the others ignore the broadcast.
    for (const event of ['share', 'connection-unexpected-closed', 'lan', 'ready'] as const) {
      peer.emitter.on(event, (...args: unknown[]) =>
        this.bridge.broadcast('multiplayer-event', event, args),
      )
    }

    const peerService = await this.app.registry.get(PeerService)
    peer.setState((await peerService.getPeerState()) as SharedState<PeerState>)
    this.stateReady = true

    // `PeerService.shareInstance` broadcasts to the windows; in Electron the
    // multiplayer preload was one of them.
    this.bridge.onBroadcast('peer-instance-shared', (options) => {
      peer.shareInstance(options as Parameters<typeof peer.shareInstance>[0])
    })

    const port = await listen(peer.host, 25566, (p) => p + 2)
    await this.bridge.invokeLocal('multiplayer-port', port)
    this.logger.log(`Multiplayer LAN bridge listening on ${port}`)

    // The TURN credentials come from the XMCL API, so they must not gate the
    // peer: without a signed-in account the request fails and the mesh still
    // works over the public STUN servers.
    void peer.updateIceServers().catch((e) => this.logger.warn(e))
    await this.watchUserState()
  }

  /** Refresh the TURN credentials whenever the signed-in account changes. */
  private async watchUserState() {
    const userService = await this.app.registry.get(UserService)
    const state = (await userService.getUserState()) as SharedState<UserState>
    state.subscribeAll((mutation: string) => {
      if (
        mutation !== 'userData' &&
        mutation !== 'userProfile' &&
        mutation !== 'userProfileRemove' &&
        mutation !== 'gameProfileUpdate'
      ) {
        return
      }
      if (this.iceRefreshTimer) clearTimeout(this.iceRefreshTimer)
      this.iceRefreshTimer = setTimeout(() => {
        this.iceRefreshTimer = undefined
        void this.peer?.updateIceServers().catch((e) => this.logger.warn(e))
      }, 250)
    })
  }

  /**
   * `multiplayer-init` is the runtime handler Electron's preload called. It
   * waits for the game data path, so it stays pending until the first-launch
   * wizard picks one.
   */
  private async getInitPayload() {
    return (await this.bridge.invokeLocal('multiplayer-init')) as {
      appDataPath: string
      resourcePath: string
      sessionId: string
      signalingBaseUrl: string
    }
  }

  private async request(path: string, method: string, body?: unknown) {
    const response = await this.app.protocol.handle({
      method,
      url: new URL(path, this.signalingBaseUrl),
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body === undefined ? undefined : (Readable.from(JSON.stringify(body)) as any),
    })
    const text = await readBody(response.body)
    if (response.status >= 400) {
      let message = text
      try {
        message = (JSON.parse(text) as { message?: string }).message || text
      } catch {
        // Keep the response text as the error message.
      }
      throw new Error(message || `multiplayer_request_failed:${response.status}`)
    }
    return text ? JSON.parse(text) : undefined
  }

  /**
   * Same validation as `xmcl-electron-app/preload/multiplayer.ts`: the
   * admission decides where the peer connects and with which ticket, so it is
   * never trusted as-is.
   */
  private parseAdmission(input: unknown): MultiplayerRoomAdmission {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('multiplayer_room_invalid_admission')
    }
    const admission = input as Record<string, unknown>
    if (
      typeof admission.roomId !== 'string' ||
      !admission.roomId ||
      typeof admission.socketUrl !== 'string' ||
      !admission.socketUrl ||
      typeof admission.ticket !== 'string' ||
      !admission.ticket ||
      typeof admission.peerId !== 'string' ||
      !admission.peerId ||
      typeof admission.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(admission.expiresAt)) ||
      (admission.role !== 'master' && admission.role !== 'member') ||
      !Number.isSafeInteger(admission.maxPeers) ||
      Number(admission.maxPeers) < 2 ||
      Number(admission.maxPeers) > 16
    ) {
      throw new Error('multiplayer_room_invalid_admission')
    }
    let socketUrl: URL
    try {
      socketUrl = new URL(admission.socketUrl, this.signalingBaseUrl)
    } catch {
      throw new Error('multiplayer_room_invalid_socket_url')
    }
    if (socketUrl.protocol === 'https:') socketUrl.protocol = 'wss:'
    if (socketUrl.protocol === 'http:') socketUrl.protocol = 'ws:'
    if (socketUrl.protocol !== 'ws:' && socketUrl.protocol !== 'wss:') {
      throw new Error(`multiplayer_room_invalid_socket_protocol:${socketUrl.protocol}`)
    }
    if (socketUrl.username || socketUrl.password || socketUrl.hash) {
      throw new Error('multiplayer_room_invalid_socket_url')
    }
    return {
      roomId: admission.roomId,
      socketUrl: socketUrl.toString(),
      ticket: admission.ticket,
      peerId: admission.peerId,
      expiresAt: admission.expiresAt,
      role: admission.role,
      maxPeers: Number(admission.maxPeers),
    }
  }
}

async function readBody(body: unknown): Promise<string> {
  if (!body) return ''
  if (typeof body === 'string') return body
  if (Buffer.isBuffer(body)) return body.toString('utf-8')
  if (body instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of body) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks).toString('utf-8')
  }
  return String(body)
}
