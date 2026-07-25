import { ConnectionUserInfo, PromiseSignal } from '@xmcl/runtime-api'
import type { MultiplayerIceServerCredential, MultiplayerRoomAdmission } from '@xmcl/runtime-api'
import type { InitiateOptions, Peers } from './peers'

type DescriptionType = 'offer' | 'answer'

export interface TransferDescription {
  session: string
  id: string
  sdp: string
  candidates: Array<{ candidate: string; mid: string }>
}

interface SignalDescription {
  sdp: string
  sdpType: DescriptionType
  session: string
  candidates: Array<{ candidate: string; mid: string }>
  iceServer?: RTCIceServer
  iceServers?: RTCIceServer[]
}

interface RoomPeer {
  peerId: string
  accountId: string
  displayName: string
  status?: 'negotiating' | 'connected'
}

type RoomServerMessage =
  | { type: 'host-ready'; self: RoomPeer; guests: RoomPeer[]; revision: number }
  | { type: 'negotiation-started'; self: RoomPeer; hostPeerId: string; revision: number }
  | { type: 'join-request'; guest: RoomPeer; revision: number }
  | { type: 'signal'; sender: string; payload: SignalDescription }
  | { type: 'guest-connected'; guest: RoomPeer; revision: number }
  | { type: 'guest-negotiation-ended'; peerId: string; revision: number }
  | { type: 'rtc-ready'; revision: number }
  | { type: 'error'; code: string }

export interface MultiplayerRoomApi {
  createRoom(displayName: string, maxPeers?: number): Promise<MultiplayerRoomAdmission>
  joinRoom(roomId: string, displayName: string): Promise<MultiplayerRoomAdmission>
  closeRoom(roomId: string): Promise<void>
  getIceServerCredential(): Promise<MultiplayerIceServerCredential>
}

interface RoomSocket {
  readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send(message: string): void
  close(code?: number, reason?: string): void
}

export function createPeerGroup(
  idSignal: PromiseSignal<string>,
  peers: Peers,
  getUserInfo: () => ConnectionUserInfo,
  initiate: (option: InitiateOptions) => void,
  setRemoteDescription: (
    d: TransferDescription,
    type: 'offer' | 'answer',
    target?: RTCIceServer,
    all?: RTCIceServer[],
  ) => string,
  roomApi: MultiplayerRoomApi,
  onstate = (state: 'connecting' | 'connected' | 'closing' | 'closed') => {},
  onerror = (_error: unknown) => {},
  onjoin = (_admission: MultiplayerRoomAdmission) => {},
  onleave = () => {},
  onuser = (_sender: string, _profile: ConnectionUserInfo) => {},
  onping = (_ping: number, _timestamp: number) => {},
) {
  let room: MultiplayerRoom | undefined

  async function joinGroup(roomId?: string) {
    try {
      await room?.quit()
      onstate('connecting')
      const localId = await idSignal.promise
      const profile = getUserInfo()
      const admission = roomId
        ? await roomApi.joinRoom(roomId, profile.name)
        : await roomApi.createRoom(profile.name, 8)
      room = new MultiplayerRoom(
        admission,
        localId,
        profile,
        peers,
        initiate,
        setRemoteDescription,
        roomApi,
      )
      room.onstate = onstate
      room.onerror = onerror
      room.onuser = onuser
      room.onping = onping
      await room.connect()
      onjoin(admission)
    } catch (error) {
      room = undefined
      onerror(error)
      onstate('closed')
    }
  }

  async function leaveGroup() {
    const current = room
    room = undefined
    if (current) await current.quit()
    onleave()
  }

  return {
    getGroup: () => room,
    joinGroup,
    leaveGroup,
  }
}

export class MultiplayerRoom {
  private socket: RoomSocket | undefined
  private closed = false
  private signalingComplete = false
  private reconnecting = false

  onstate = (_state: 'connecting' | 'connected' | 'closing' | 'closed') => {}
  onerror = (_error: unknown) => {}
  onuser = (_sender: string, _profile: ConnectionUserInfo) => {}
  onping = (_ping: number, _timestamp: number) => {}

  constructor(
    private admission: MultiplayerRoomAdmission,
    readonly localId: string,
    readonly profile: ConnectionUserInfo,
    private readonly peers: Peers,
    private readonly initiatePeer: (option: InitiateOptions) => void,
    private readonly applyRemoteDescription: (
      d: TransferDescription,
      type: 'offer' | 'answer',
      target?: RTCIceServer,
      all?: RTCIceServer[],
    ) => string,
    private readonly roomApi: MultiplayerRoomApi,
    private readonly createSocket: (url: string) => RoomSocket = (url) => new WebSocket(url),
  ) {}

  get roomId() {
    return this.admission.roomId
  }

  get role() {
    return this.admission.role
  }

  async connect() {
    if (this.closed) return
    this.onstate('connecting')
    const url = new URL(this.admission.socketUrl)
    url.searchParams.set('ticket', this.admission.ticket)
    const socket = this.createSocket(url.toString())
    this.socket = socket
    await new Promise<void>((resolve, reject) => {
      let opened = false
      let settled = false
      socket.onopen = () => {
        opened = true
        settled = true
        resolve()
      }
      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        this.handle(JSON.parse(event.data) as RoomServerMessage)
      }
      socket.onerror = (event) => {
        if (!opened && !settled) {
          settled = true
          reject(new Error('multiplayer_room_websocket_upgrade_failed', { cause: event }))
        } else {
          this.reportError(event)
        }
      }
      socket.onclose = (event) => {
        if (socket !== this.socket || this.closed) return
        this.socket = undefined
        if (!opened) {
          if (!settled) {
            settled = true
            reject(new Error(`multiplayer_room_websocket_closed_before_open:${event.code}`))
          }
          return
        }
        if (this.role === 'guest' && this.signalingComplete && event.code === 1000) {
          this.onstate('connected')
          return
        }
        this.restore().catch((error) => this.fail(error))
      }
    })
  }

  async sendLocalDescription(
    receiverId: string,
    sdp: string,
    type: DescriptionType,
    candidates: Array<{ candidate: string; mid: string }>,
    iceServer: RTCIceServer,
    iceServers: RTCIceServer[],
    _shouldRetry: () => boolean,
  ) {
    this.send({
      type: 'signal',
      receiver: receiverId,
      payload: {
        sdp,
        sdpType: type,
        session: this.peers.get(receiverId)?.id ?? '',
        candidates,
        iceServer,
        iceServers,
      },
    })
  }

  sendWho(_receiverId: string) {
    // Identity is exchanged over the authenticated metadata DataChannel.
  }

  markConnected(remoteId: string) {
    if (this.role !== 'guest') return
    const peer = this.peers.get(remoteId)
    if (!peer || !peer.isDataChannelEstablished()) return
    this.signalingComplete = true
    this.send({ type: 'rtc-ready' })
  }

  removePeer(remoteId: string, kick = false) {
    if (this.role !== 'host') return
    this.send({ type: kick ? 'kick' : 'guest-left', peerId: remoteId })
  }

  private handle(message: RoomServerMessage) {
    if (message.type === 'host-ready') {
      this.onstate('connected')
      for (const guest of message.guests) {
        if (!this.peers.get(guest.peerId) && guest.status !== 'connected') {
          this.initiatePeer({ remoteId: guest.peerId, initiate: true })
        }
      }
      return
    }
    if (message.type === 'negotiation-started') {
      return
    }
    if (message.type === 'join-request') {
      if (this.role === 'host' && !this.peers.get(message.guest.peerId)) {
        this.initiatePeer({ remoteId: message.guest.peerId, initiate: true })
      }
      return
    }
    if (message.type === 'signal') {
      const payload = message.payload
      this.applyRemoteDescription(
        {
          id: message.sender,
          session: payload.session,
          sdp: payload.sdp,
          candidates: payload.candidates,
        },
        payload.sdpType,
        payload.iceServer,
        payload.iceServers,
      )
      return
    }
    if (message.type === 'guest-negotiation-ended') {
      const peer = this.peers.get(message.peerId)
      peer?.close()
      this.peers.remove(message.peerId)
      return
    }
    if (message.type === 'rtc-ready') {
      this.signalingComplete = true
      this.onstate('connected')
      return
    }
    if (message.type === 'error') {
      this.reportError(new Error(`multiplayer_room_${message.code}`))
    }
  }

  private send(message: unknown) {
    if (this.socket?.readyState !== 1) {
      throw new Error('multiplayer_room_socket_unavailable')
    }
    this.socket.send(JSON.stringify(message))
  }

  private async restore() {
    if (this.closed || this.reconnecting) return
    this.reconnecting = true
    this.onstate('connecting')
    try {
      const delays = [0, 500, 1_000, 2_000, 4_000]
      let lastError: unknown
      for (const delay of delays) {
        if (this.closed) return
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
        try {
          const restored = await this.roomApi.joinRoom(this.roomId, this.profile.name)
          this.admission = { ...restored, role: this.role }
          await this.connect()
          return
        } catch (error) {
          lastError = error
        }
      }
      throw lastError ?? new Error('multiplayer_room_restore_failed')
    } finally {
      this.reconnecting = false
    }
  }

  private fail(error: unknown) {
    this.reportError(error)
    this.onstate('closed')
  }

  private reportError(error: unknown) {
    this.onerror(error)
  }

  async quit() {
    if (this.closed) return
    this.closed = true
    this.onstate('closing')
    if (this.role === 'host') {
      await this.roomApi.closeRoom(this.roomId).catch((error) => this.reportError(error))
    }
    this.socket?.close(1000, 'Client left')
    this.socket = undefined
    this.onstate('closed')
  }
}
