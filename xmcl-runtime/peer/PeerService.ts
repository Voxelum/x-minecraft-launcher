import {
  PeerService as IPeerService,
  SharedState,
  PeerServiceKey,
  PeerState,
  ShareInstanceOptions,
  MultiplayerInitPayload,
  MultiplayerLogEvent,
  MultiplayerTransport,
  ConnectionUserInfo,
  SetRemoteDescriptionOptions,
} from '@xmcl/runtime-api'
import { Inject, LauncherApp, LauncherAppKey, kGameDataPath } from '~/app'
import { ExposeServiceKey, ServiceStateManager, StatefulService } from '~/service'
import { kPeerFacade } from './PeerServiceFacade'
import { kClientToken, kFlights, launcherSessionId } from '~/infra'
import { resolveXmclApiEndpoints } from '~/app/xmclApiBaseUrl'
import { kSettings } from '~/settings'
import { XmclAccountService } from '~/xmclAccount'
import {
  kMultiplayerHostFactory,
  type MultiplayerHost,
} from './MultiplayerHost'

function isMultiplayerLogEvent(value: unknown): value is MultiplayerLogEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const event = value as Record<string, unknown>
  return (
    (event.level === 'info' || event.level === 'warn' || event.level === 'error') &&
    typeof event.event === 'string' &&
    /^[a-z0-9_.-]{1,80}$/.test(event.event) &&
    (event.data === undefined ||
      (!!event.data && typeof event.data === 'object' && !Array.isArray(event.data)))
  )
}

const sensitiveMultiplayerLogKey = /^(candidate|credential|description|password|sdp|token|username)$/i

function sanitizeMultiplayerLogValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]'
  if (typeof value === 'string') return value.slice(0, 1_024)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) {
    return value.slice(0, 32).map((entry) => sanitizeMultiplayerLogValue(entry, depth + 1))
  }
  if (!value || typeof value !== 'object') return String(value)
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 64)
      .map(([key, entry]) => [
        key,
        sensitiveMultiplayerLogKey.test(key)
          ? '[redacted]'
          : sanitizeMultiplayerLogValue(entry, depth + 1),
      ]),
  )
}

@ExposeServiceKey(PeerServiceKey)
export class PeerService extends StatefulService<PeerState> implements IPeerService {
  private multiplayerHost: Promise<MultiplayerHost> | undefined
  private multiplayerHostTransport: MultiplayerTransport | undefined
  private hostTransition = Promise.resolve()
  private downloadPort = 25_566

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
  ) {
    super(
      app,
      () => store.registerStatic(new PeerState(), PeerServiceKey),
      async () => {},
    )

    const queryGameProfile = async (name: string) => {
      return this.state.connections.find((c) => c.userInfo.name === name || c.userInfo.id === name)
        ?.userInfo
    }

    app.registry.register(kPeerFacade, {
      queryGameProfile,
      getHttpDownloadUrl: (url) => {
        const peerUrl = new URL(url)
        if (peerUrl.protocol !== 'peer:') {
          throw new Error(`Bad url: ${url}`)
        }

        const orignalFilePath = decodeURI(peerUrl.pathname)
        const urlBase64 = Buffer.from(orignalFilePath).toString('base64url')

        const realUrl = new URL(
          `http://localhost:${this.downloadPort}/files/${peerUrl.host}?path=${urlBase64}`,
        ).toString()

        return realUrl
      },
    })

    app.registryDisposer(() => this.disposeMultiplayerHost())
  }

  private async getMultiplayerHost() {
    const settings = await this.app.registry.get(kSettings)
    return this.ensureMultiplayerHost(settings.multiplayerTransport)
  }

  private async createMultiplayerHost(transport: MultiplayerTransport) {
    const factory = await this.app.registry.get(kMultiplayerHostFactory)
    const settings = await this.app.registry.get(kSettings)
    const accountState = await this.app.registry
      .get(XmclAccountService)
      .then((service) => service.getXmclAccountState())
    const host = await factory({
      transport,
      state: this.state,
      init: await this.getMultiplayerInit(),
      log: (event) => { void this.logMultiplayer(event) },
      isTelemetryEnabled: () => !settings.disableTelemetry,
      getTelemetryAccountId: () => accountState.account?.accountId,
      setDownloadPort: (port) => { this.downloadPort = port },
    })
    host.on('share', (payload) => this.emit('share', payload))
    host.on('connection-unexpected-closed', (payload) =>
      this.emit('connection-unexpected-closed', payload),
    )
    host.on('local-lan', (payload) => this.emit('local-lan', payload))
    host.on('lan', (payload) => this.emit('lan', payload))
    return host
  }

  private async ensureMultiplayerHost(transport: MultiplayerTransport) {
    let result: MultiplayerHost | undefined
    const operation = this.hostTransition.catch(() => {}).then(async () => {
      if (this.multiplayerHost && this.multiplayerHostTransport === transport) {
        result = await this.multiplayerHost
        return
      }
      await this.disposeCurrentMultiplayerHost()
      this.multiplayerHostTransport = transport
      const pending = this.createMultiplayerHost(transport)
      this.multiplayerHost = pending
      try {
        result = await pending
        void result.closed.then(() => {
          if (this.multiplayerHost === pending) {
            this.multiplayerHost = undefined
            this.multiplayerHostTransport = undefined
          }
        })
      } catch (error) {
        if (this.multiplayerHost === pending) {
          this.multiplayerHost = undefined
          this.multiplayerHostTransport = undefined
        }
        throw error
      }
    })
    this.hostTransition = operation.then(() => {}, () => {})
    await operation
    if (!result) throw new Error('multiplayer_host_unavailable')
    return result
  }

  private async disposeCurrentMultiplayerHost() {
    const pending = this.multiplayerHost
    this.multiplayerHost = undefined
    this.multiplayerHostTransport = undefined
    if (pending) await (await pending).dispose()
  }

  async getPeerState(): Promise<SharedState<PeerState>> {
    return this.state
  }

  private async getMultiplayerInit(): Promise<MultiplayerInitPayload> {
    const resourcePath = (await this.app.registry.get(kGameDataPath))()
    const sessionId = await this.app.registry.get(kClientToken)
    const flights = await this.app.registry.get(kFlights)
    const signalingBaseUrl = resolveXmclApiEndpoints(flights.xmclApiBaseUrl, () =>
      this.app
        .getLogger('MultiplayerApi')
        .warn('Ignoring invalid xmclApiUrl flight; using default XMCL API origins.'),
    ).signaling
    return {
      appDataPath: this.app.appDataPath,
      resourcePath,
      sessionId,
      launcherSessionId,
      signalingBaseUrl,
    }
  }

  private async logMultiplayer(event: MultiplayerLogEvent): Promise<void> {
    if (!isMultiplayerLogEvent(event)) return
    const data = event.data ? sanitizeMultiplayerLogValue(event.data) : undefined
    const message = `${event.event}${data ? ` ${JSON.stringify(data)}` : ''}`
    if (message.length > 8_192) return
    const multiplayerLogger = this.app.getLogger('WebRTC', 'multiplayer')
    if (event.level === 'error') {
      multiplayerLogger.warn(`[error] ${message}`)
    } else if (event.level === 'warn') {
      multiplayerLogger.warn(message)
    } else {
      multiplayerLogger.log(message)
    }
  }

  async setMultiplayerTransport(transport: MultiplayerTransport): Promise<void> {
    await this.ensureMultiplayerHost(transport)
  }

  private async disposeMultiplayerHost(): Promise<void> {
    const operation = this.hostTransition.catch(() => {}).then(() => this.disposeCurrentMultiplayerHost())
    this.hostTransition = operation.then(() => {}, () => {})
    await operation
  }

  async multiplayerRefreshIceServers(): Promise<void> {
    await (await this.getMultiplayerHost()).refreshIceServers()
  }

  async multiplayerSetUserInfo(info: ConnectionUserInfo): Promise<void> {
    ;(await this.getMultiplayerHost()).setUserInfo(info)
  }

  async multiplayerInitiate(): Promise<string> {
    return (await this.getMultiplayerHost()).initiate()
  }

  async multiplayerSetRemoteDescription(options: SetRemoteDescriptionOptions): Promise<string> {
    return (await this.getMultiplayerHost()).setRemoteDescription(options)
  }

  async multiplayerDrop(id: string): Promise<void> {
    await (await this.getMultiplayerHost()).drop(id)
  }

  async multiplayerCreateGroup(): Promise<void> {
    await (await this.getMultiplayerHost()).createGroup()
  }

  async multiplayerJoinGroup(groupId: string): Promise<void> {
    await (await this.getMultiplayerHost()).joinGroup(groupId)
  }

  async multiplayerTransferGroupMaster(peerId: string): Promise<void> {
    await (await this.getMultiplayerHost()).transferGroupMaster(peerId)
  }

  async multiplayerLeaveGroup(): Promise<void> {
    await (await this.getMultiplayerHost()).leaveGroup()
  }

  async shareInstance(options: ShareInstanceOptions): Promise<void> {
    await (await this.getMultiplayerHost()).shareInstance(options)
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
