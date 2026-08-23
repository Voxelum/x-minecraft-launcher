import type {
  ConnectionUserInfo,
  MultiplayerIceServerCredential,
  MultiplayerRoomAdmission,
  MultiplayerRoomMember,
  MultiplayerRoomState,
  TransferDescription,
} from '@xmcl/runtime-api'

export interface MultiplayerRoomLogger {
  emit(event: {
    level: 'info' | 'warn' | 'error'
    event: string
    data?: Record<string, unknown>
  }): void
}

export interface TogetherRoomApi {
  createRoom(displayName: string, maxPeers: number): Promise<MultiplayerRoomAdmission>
  joinRoom(roomId: string, displayName: string, createIfMissing: boolean): Promise<MultiplayerRoomAdmission>
  closeRoom(roomId: string): Promise<void>
  getIceServerCredential(): Promise<MultiplayerIceServerCredential>
}

export interface TogetherRoomApiOptions {
  getBaseUrl(): string | Promise<string>
  fetch(url: string, init: RequestInit): Promise<Response>
}

export function createTogetherRoomApi(options: TogetherRoomApiOptions): TogetherRoomApi {
  const request = async (path: string, init: RequestInit) => {
    const baseUrl = await options.getBaseUrl()
    const headers = new Headers(init.headers)
    if (init.body) headers.set('Content-Type', 'application/json')
    const response = await options.fetch(new URL(path, baseUrl).toString(), {
      ...init,
      headers,
      credentials: 'include',
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let message = text
      try {
        message = (JSON.parse(text) as { message?: string }).message || text
      } catch {}
      throw new Error(message || `multiplayer_request_failed:${response.status}`)
    }
    return { response, baseUrl }
  }
  return {
    async createRoom(displayName, maxPeers) {
      const { response, baseUrl } = await request('/v1/multiplayer/rooms', {
        method: 'POST',
        body: JSON.stringify({ displayName, maxPeers }),
      })
      return parseRoomAdmission(await response.json(), baseUrl)
    },
    async joinRoom(roomId, displayName, createIfMissing) {
      const { response, baseUrl } = await request(
        `/v1/multiplayer/rooms/${encodeURIComponent(roomId)}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ displayName, createIfMissing }),
        },
      )
      return parseRoomAdmission(await response.json(), baseUrl)
    },
    async closeRoom(roomId) {
      await request(`/v1/multiplayer/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' })
    },
    async getIceServerCredential() {
      const { response } = await request('/v1/rtc/official', { method: 'POST' })
      return (await response.json()) as MultiplayerIceServerCredential
    },
  }
}

export function parseRoomAdmission(input: unknown, signalingBaseUrl: string): MultiplayerRoomAdmission {
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
  const socketUrl = new URL(admission.socketUrl, signalingBaseUrl)
  if (socketUrl.protocol === 'https:') socketUrl.protocol = 'wss:'
  if (socketUrl.protocol === 'http:') socketUrl.protocol = 'ws:'
  if (
    (socketUrl.protocol !== 'ws:' && socketUrl.protocol !== 'wss:') ||
    socketUrl.username ||
    socketUrl.password ||
    socketUrl.hash
  ) {
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

export interface TogetherRoomCallbacks {
  initiate(remoteId: string): void
  apply(remoteId: string, description: TransferDescription, type: 'offer' | 'answer', sharedTurn?: RTCIceServer): void
  drop(remoteId: string): void
  remap(previousRemoteId: string, remoteId: string): void
  hasOpenMetadata(remoteId: string): boolean
  onState(state: 'connecting' | 'connected' | 'closing' | 'closed'): void
  onRoomState(state: MultiplayerRoomState): void
  onReset(): void
  onError(error: unknown): void
  onPing(ping: number, timestamp: number): void
}

export interface MultiplayerRoomSocket {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send(message: string): void
  close(code?: number, reason?: string): void
}

type ServerMessage =
  | ({ type: 'room-state' } & MultiplayerRoomState)
  | {
      type: 'signal'
      sender: string
      payload: {
        sdp: string
        sdpType: 'offer' | 'answer'
        session: string
        candidates: Array<{ candidate: string; mid: string }>
        sharedTurnServer?: RTCIceServer
      }
    }
  | { type: 'error'; code: string }

const openTimeout = 10_000
const transferTimeout = 10_000
const peerReconnectGrace = 15_000
const socketOpen = 1

export class TogetherRoom {
  private socket: MultiplayerRoomSocket | undefined
  private closed = false
  private restoring = false
  private hasSnapshot = false
  private selfPeerId: string
  private masterPeerId = ''
  private members: MultiplayerRoomMember[] = []
  private revision = -1
  private status: MultiplayerRoomState['status'] = 'open'
  private readonly pendingPeerDrops = new Map<
    string,
    { peerId: string; timer: ReturnType<typeof setTimeout> }
  >()
  private pendingTransfer:
    | {
        peerId: string
        revision: number
        resolve: () => void
        reject: (error: unknown) => void
        timer: ReturnType<typeof setTimeout>
      }
    | undefined

  constructor(
    private admission: MultiplayerRoomAdmission,
    private readonly profile: ConnectionUserInfo,
    private readonly api: TogetherRoomApi,
    private readonly callbacks: TogetherRoomCallbacks,
    private readonly logger: MultiplayerRoomLogger,
    private readonly createSocket: (url: string) => MultiplayerRoomSocket = (url) => new WebSocket(url),
  ) {
    this.selfPeerId = admission.peerId
  }

  get roomId() {
    return this.admission.roomId
  }

  get role() {
    if (!this.hasSnapshot) return this.admission.role
    return this.selfPeerId === this.masterPeerId ? 'master' : 'member'
  }

  async connect() {
    if (this.closed) return
    this.callbacks.onState('connecting')
    const url = new URL(this.admission.socketUrl)
    url.searchParams.set('ticket', this.admission.ticket)
    const socket = this.createSocket(url.toString())
    this.socket = socket
    await new Promise<void>((resolve, reject) => {
      let opened = false
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        socket.close(1000, 'Upgrade timeout')
        reject(new Error('multiplayer_room_websocket_upgrade_timeout'))
      }, openTimeout)
      socket.onopen = () => {
        opened = true
        settled = true
        clearTimeout(timer)
        this.callbacks.onState('connected')
        resolve()
      }
      socket.onmessage = ({ data }) => {
        if (typeof data !== 'string') {
          this.fail(new Error('multiplayer_room_protocol_error:non_text_message'), 1002)
          return
        }
        try {
          this.handle(parseMessage(JSON.parse(data)))
        } catch (error) {
          this.fail(error, 1002)
        }
      }
      socket.onerror = () => {
        if (!opened && !settled) {
          settled = true
          clearTimeout(timer)
          reject(new Error('multiplayer_room_websocket_upgrade_failed'))
        }
      }
      socket.onclose = ({ code, reason }) => {
        if (socket !== this.socket) return
        this.socket = undefined
        if (!opened) {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            reject(new Error(`multiplayer_room_websocket_closed_before_open:${code}`))
          }
          return
        }
        if (this.closed) return
        if (code === 4000 || code === 4001 || code === 4003) {
          this.fail(new Error(`multiplayer_room_closed:${code}:${reason}`))
        } else {
          void this.restore()
        }
      }
    })
  }

  sendDescription(
    remoteId: string,
    description: TransferDescription,
    type: 'offer' | 'answer',
    sharedTurnServer?: RTCIceServer,
  ) {
    if (!this.hasSnapshot) return
    const member = this.members.find((value) => value.peerId === remoteId)
    if (!member || remoteId === this.selfPeerId) return
    if (this.role === 'member' && remoteId !== this.masterPeerId) return
    const message = {
      type: 'signal',
      payload: {
        sdp: description.sdp,
        sdpType: type,
        session: description.session,
        candidates: description.candidates,
        ...(sharedTurnServer ? { sharedTurnServer } : {}),
      },
    }
    this.send(this.role === 'master' ? { ...message, receiver: remoteId } : message)
  }

  setRtcState(remoteId: string, state: 'connected' | 'negotiating') {
    if (
      !this.hasSnapshot ||
      this.role !== 'member' ||
      remoteId !== this.masterPeerId ||
      this.socket?.readyState !== socketOpen
    ) {
      return
    }
    if (state === 'connected' && !this.callbacks.hasOpenMetadata(remoteId)) return
    this.send({ type: 'rtc-state', state })
  }

  canRemove(remoteId: string) {
    return this.role === 'master' && this.members.some((member) => member.peerId === remoteId)
  }

  remove(remoteId: string) {
    if (!this.canRemove(remoteId) || remoteId === this.selfPeerId) {
      throw new Error('multiplayer_room_remove_target_invalid')
    }
    this.send({ type: 'remove-member', peerId: remoteId })
    this.callbacks.drop(remoteId)
  }

  transferMaster(peerId: string) {
    if (this.pendingTransfer) return Promise.reject(new Error('multiplayer_room_transfer_pending'))
    const target = this.members.find((member) => member.peerId === peerId)
    if (this.role !== 'master' || !target || target.status !== 'connected') {
      return Promise.reject(new Error('multiplayer_room_transfer_target_invalid'))
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rejectTransfer(new Error('multiplayer_room_transfer_timeout'))
      }, transferTimeout)
      this.pendingTransfer = { peerId, revision: this.revision, resolve, reject, timer }
      try {
        this.send({ type: 'transfer-master', peerId })
      } catch (error) {
        this.rejectTransfer(error)
      }
    })
  }

  async quit() {
    if (this.closed) return
    const wasMaster = this.role === 'master'
    const successor = wasMaster
      ? this.members
          .filter((member) => member.peerId !== this.selfPeerId && member.status === 'connected')
          .sort((left, right) => left.joinedAt - right.joinedAt)[0]
      : undefined
    if (successor) {
      await this.transferMaster(successor.peerId).catch(this.callbacks.onError)
    }
    this.closed = true
    this.callbacks.onState('closing')
    this.closePeers()
    this.rejectTransfer(new Error('multiplayer_room_transfer_cancelled'))
    if (wasMaster && !successor) await this.api.closeRoom(this.roomId).catch(this.callbacks.onError)
    this.socket?.close(1000, 'Client left')
    this.socket = undefined
    this.callbacks.onState('closed')
  }

  private handle(message: ServerMessage) {
    if (message.type === 'room-state') {
      this.applyState(message)
      return
    }
    if (message.type === 'error') {
      const error = new Error(`multiplayer_room_${message.code}`)
      this.rejectTransfer(error)
      this.callbacks.onError(error)
      return
    }
    if (
      !this.hasSnapshot ||
      !this.members.some((member) => member.peerId === message.sender) ||
      (this.role === 'member' && message.sender !== this.masterPeerId)
    ) {
      throw new Error('multiplayer_room_protocol_error:unauthorized_signal_sender')
    }
    this.callbacks.apply(
      message.sender,
      {
        id: message.sender,
        session: message.payload.session,
        sdp: message.payload.sdp,
        candidates: message.payload.candidates,
      },
      message.payload.sdpType,
      message.payload.sharedTurnServer,
    )
  }

  private applyState(state: MultiplayerRoomState) {
    if (state.selfPeerId !== this.admission.peerId) {
      throw new Error('multiplayer_room_protocol_error:self_peer_id_mismatch')
    }
    if (state.revision <= this.revision) return
    if (state.status === 'closed') {
      this.closed = true
      this.closePeers()
      this.socket?.close(1000, 'Room closed')
      this.callbacks.onState('closed')
      this.callbacks.onReset()
      return
    }
    const previousSelfPeerId = this.selfPeerId
    const previousMembers = this.members
    const nextMembers = new Set(state.members.map((member) => member.peerId))
    const retainedPeers = new Set<string>()
    for (const member of state.members) {
      const pending = this.pendingPeerDrops.get(member.accountId)
      if (!pending) continue
      clearTimeout(pending.timer)
      this.pendingPeerDrops.delete(member.accountId)
      if (pending.peerId !== member.peerId) {
        this.callbacks.remap(pending.peerId, member.peerId)
      }
      retainedPeers.add(member.peerId)
    }
    for (const member of previousMembers) {
      if (member.peerId === previousSelfPeerId) continue
      if (nextMembers.has(member.peerId)) {
        retainedPeers.add(member.peerId)
        continue
      }
      const replacement = state.members.find((next) =>
        next.peerId !== state.selfPeerId && next.accountId === member.accountId
      )
      if (replacement) {
        this.callbacks.remap(member.peerId, replacement.peerId)
        retainedPeers.add(replacement.peerId)
      } else if (!this.pendingPeerDrops.has(member.accountId)) {
        const pending = {
          peerId: member.peerId,
          timer: setTimeout(() => {
            if (this.pendingPeerDrops.get(member.accountId) !== pending) return
            this.pendingPeerDrops.delete(member.accountId)
            this.callbacks.drop(member.peerId)
          }, peerReconnectGrace),
        }
        this.pendingPeerDrops.set(member.accountId, pending)
      }
    }
    const masterChanged = !!this.masterPeerId && this.masterPeerId !== state.masterPeerId
    this.selfPeerId = state.selfPeerId
    this.masterPeerId = state.masterPeerId
    this.members = state.members
    this.revision = state.revision
    this.status = state.status
    this.hasSnapshot = true
    this.logger.emit({
      level: 'info',
      event: 'together.room.state',
      data: {
        room: this.roomId,
        revision: state.revision,
        role: this.role,
        status: state.status,
        selfPeerId: state.selfPeerId,
        masterPeerId: state.masterPeerId,
        members: state.members.map((member) => ({
          peerId: member.peerId,
          status: member.status,
          role: member.peerId === state.masterPeerId ? 'master' : 'member',
        })),
      },
    })
    this.callbacks.onRoomState({ ...state, members: state.members.map((member) => ({ ...member })) })
    if (this.role === 'master' && state.status === 'open') {
      for (const member of state.members) {
        if (member.peerId !== this.selfPeerId) {
          this.logger.emit({
            level: 'info',
            event: 'together.room.ensure_peer',
            data: {
              room: this.roomId,
              revision: state.revision,
              remoteId: member.peerId,
              memberStatus: member.status,
              reason: masterChanged
                ? 'master_changed'
                : retainedPeers.has(member.peerId)
                  ? 'existing_member'
                  : 'new_member',
            },
          })
          this.callbacks.initiate(member.peerId)
        }
      }
    }
    const pending = this.pendingTransfer
    if (pending && state.revision > pending.revision) {
      if (state.masterPeerId === pending.peerId) {
        this.pendingTransfer = undefined
        clearTimeout(pending.timer)
        pending.resolve()
      } else if (state.masterPeerId !== this.selfPeerId) {
        this.rejectTransfer(new Error('multiplayer_room_transfer_superseded'))
      }
    }
  }

  private send(message: unknown) {
    if (this.socket?.readyState !== socketOpen) {
      throw new Error('multiplayer_room_socket_unavailable')
    }
    this.socket.send(JSON.stringify(message))
  }

  private closePeers() {
    const peerIds = new Set<string>()
    for (const member of this.members) {
      if (member.peerId !== this.selfPeerId) peerIds.add(member.peerId)
    }
    for (const pending of this.pendingPeerDrops.values()) {
      clearTimeout(pending.timer)
      peerIds.add(pending.peerId)
    }
    this.pendingPeerDrops.clear()
    for (const peerId of peerIds) this.callbacks.drop(peerId)
  }

  private async restore() {
    if (this.closed || this.restoring) return
    this.restoring = true
    this.callbacks.onState('connecting')
    let lastError: unknown
    try {
      for (const delay of [0, 500, 1_000, 2_000, 4_000, 5_000]) {
        if (this.closed) return
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 250))
        try {
          const admission = await this.api.joinRoom(this.roomId, this.profile.name, false)
          if (this.closed) return
          this.admission = admission
          this.hasSnapshot = false
          this.revision = -1
          await this.connect()
          return
        } catch (error) {
          lastError = error
        }
      }
      this.fail(lastError ?? new Error('multiplayer_room_restore_failed'))
    } finally {
      this.restoring = false
    }
  }

  private rejectTransfer(error: unknown) {
    const pending = this.pendingTransfer
    if (!pending) return
    this.pendingTransfer = undefined
    clearTimeout(pending.timer)
    pending.reject(error)
  }

  private fail(error: unknown, code = 1000) {
    if (this.closed) return
    this.closed = true
    this.closePeers()
    this.rejectTransfer(error)
    this.socket?.close(code, code === 1002 ? 'Protocol error' : 'Room unavailable')
    this.socket = undefined
    this.callbacks.onState('closed')
    this.callbacks.onReset()
    this.callbacks.onError(error)
    this.logger.emit({
      level: 'error',
      event: 'together.room.failed',
      data: { room: this.roomId, ...summarizeRoomError(error) },
    })
  }
}

function parseMessage(value: unknown): ServerMessage {
  const message = record(value, 'invalid_message')
  if (message.type === 'error') {
    if (typeof message.code !== 'string' || !message.code) throw protocol('invalid_error')
    return { type: 'error', code: message.code }
  }
  if (message.type === 'signal') {
    const payload = record(message.payload, 'invalid_signal')
    if (
      typeof message.sender !== 'string' ||
      typeof payload.sdp !== 'string' ||
      (payload.sdpType !== 'offer' && payload.sdpType !== 'answer') ||
      typeof payload.session !== 'string' ||
      !Array.isArray(payload.candidates)
    ) {
      throw protocol('invalid_signal')
    }
    return {
      type: 'signal',
      sender: message.sender,
      payload: {
        sdp: payload.sdp,
        sdpType: payload.sdpType,
        session: payload.session,
        candidates: payload.candidates.map((candidate) => {
          const item = record(candidate, 'invalid_candidate')
          if (typeof item.candidate !== 'string' || typeof item.mid !== 'string') {
            throw protocol('invalid_candidate')
          }
          return { candidate: item.candidate, mid: item.mid }
        }),
        sharedTurnServer: parseTurnServer(payload.sharedTurnServer),
      },
    }
  }
  if (message.type !== 'room-state' || !Array.isArray(message.members)) {
    throw protocol('unsupported_message')
  }
  const members = message.members.map((value) => {
    const member = record(value, 'invalid_member')
    if (
      typeof member.peerId !== 'string' ||
      typeof member.accountId !== 'string' ||
      typeof member.displayName !== 'string' ||
      (member.status !== 'negotiating' && member.status !== 'connected') ||
      !Number.isSafeInteger(member.joinedAt)
    ) {
      throw protocol('invalid_member')
    }
    return member as unknown as MultiplayerRoomMember
  })
  if (
    typeof message.selfPeerId !== 'string' ||
    typeof message.masterPeerId !== 'string' ||
    (message.status !== 'open' && message.status !== 'waiting-master' && message.status !== 'closed') ||
    !Number.isSafeInteger(message.maxPeers) ||
    !Number.isSafeInteger(message.revision)
  ) {
    throw protocol('invalid_room_state')
  }
  return {
    type: 'room-state',
    selfPeerId: message.selfPeerId,
    masterPeerId: message.masterPeerId,
    members,
    status: message.status,
    maxPeers: Number(message.maxPeers),
    revision: Number(message.revision),
  }
}

function parseTurnServer(value: unknown): RTCIceServer | undefined {
  if (value === undefined) return undefined
  const server = record(value, 'invalid_turn_server')
  const urls = typeof server.urls === 'string' ? [server.urls] : server.urls
  if (
    !Array.isArray(urls) ||
    !urls.every((url) => typeof url === 'string' && (url.startsWith('turn:') || url.startsWith('turns:'))) ||
    typeof server.username !== 'string' ||
    typeof server.credential !== 'string'
  ) {
    throw protocol('invalid_turn_server')
  }
  return server as unknown as RTCIceServer
}

function record(value: unknown, reason: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw protocol(reason)
  return value as Record<string, unknown>
}

function protocol(reason: string) {
  return new Error(`multiplayer_room_protocol_error:${reason}`)
}

function summarizeRoomError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message.slice(0, 1_024) }
  }
  return { name: 'UnknownError', message: String(error).slice(0, 1_024) }
}