import { ConnectionUserInfo, PromiseSignal } from '@xmcl/runtime-api'
import type {
  MultiplayerIceServerCredential,
  MultiplayerRoomAdmission,
  MultiplayerRoomMember,
  MultiplayerRoomState,
} from '@xmcl/runtime-api'
import type { InitiateOptions, Peers } from './peers'

type DescriptionType = 'offer' | 'answer'
type MultiplayerRole = MultiplayerRoomAdmission['role']
const TRANSFER_MASTER_TIMEOUT_MS = 10_000

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
  sharedTurnServer?: RTCIceServer
}

type RoomServerMessage =
  | ({ type: 'room-state' } & MultiplayerRoomState)
  | { type: 'signal'; sender: string; payload: SignalDescription }
  | { type: 'error'; code: string }

export interface MultiplayerRoomApi {
  createRoom(displayName: string, maxPeers: number): Promise<MultiplayerRoomAdmission>
  joinRoom(
    roomId: string,
    displayName: string,
    createIfMissing: boolean,
  ): Promise<MultiplayerRoomAdmission>
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

class MultiplayerProtocolError extends Error {
  constructor(reason: string) {
    super(`multiplayer_room_protocol_error:${reason}`)
  }
}

function record(value: unknown, reason: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MultiplayerProtocolError(reason)
  }
  return value as Record<string, unknown>
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const allowed = new Set([...required, ...optional])
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw new MultiplayerProtocolError('invalid_message_shape')
  }
}

function nonEmptyString(value: unknown, reason: string): string {
  if (typeof value !== 'string' || !value) throw new MultiplayerProtocolError(reason)
  return value
}

function nonNegativeInteger(value: unknown, reason: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new MultiplayerProtocolError(reason)
  }
  return Number(value)
}

function positiveInteger(value: unknown, reason: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new MultiplayerProtocolError(reason)
  }
  return Number(value)
}

function parseCandidate(value: unknown): { candidate: string; mid: string } {
  const candidate = record(value, 'invalid_candidate')
  exactKeys(candidate, ['candidate', 'mid'])
  if (typeof candidate.mid !== 'string') {
    throw new MultiplayerProtocolError('invalid_candidate')
  }
  return {
    candidate: nonEmptyString(candidate.candidate, 'invalid_candidate'),
    mid: candidate.mid,
  }
}

function parseSharedTurnServer(value: unknown): RTCIceServer {
  const server = record(value, 'invalid_ice_server')
  exactKeys(server, ['urls'], ['username', 'credential', 'credentialType'])
  const urls = server.urls
  const entries = typeof urls === 'string' ? [urls] : urls
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 8) {
    throw new MultiplayerProtocolError('invalid_ice_server')
  }
  if (
    !entries.every(
      (entry) =>
        typeof entry === 'string' &&
        entry.length <= 512 &&
        (entry.startsWith('turn:') || entry.startsWith('turns:')),
    )
  ) {
    throw new MultiplayerProtocolError('invalid_ice_server')
  }
  if (
    typeof server.username !== 'string' ||
    !server.username ||
    server.username.length > 512 ||
    typeof server.credential !== 'string' ||
    !server.credential ||
    server.credential.length > 512
  ) {
    throw new MultiplayerProtocolError('invalid_ice_server')
  }
  if (server.credentialType !== undefined && server.credentialType !== 'password') {
    throw new MultiplayerProtocolError('invalid_ice_server')
  }
  return server as unknown as RTCIceServer
}

export function isShareableTurnServer(server: RTCIceServer | undefined): server is RTCIceServer {
  if (!server) return false
  try {
    parseSharedTurnServer(server)
    return true
  } catch {
    return false
  }
}

function parseSignalDescription(value: unknown): SignalDescription {
  const payload = record(value, 'invalid_signal')
  exactKeys(payload, ['sdp', 'sdpType', 'session', 'candidates'], ['sharedTurnServer'])
  if (payload.sdpType !== 'offer' && payload.sdpType !== 'answer') {
    throw new MultiplayerProtocolError('invalid_signal')
  }
  if (!Array.isArray(payload.candidates)) {
    throw new MultiplayerProtocolError('invalid_signal')
  }
  return {
    sdp: nonEmptyString(payload.sdp, 'invalid_signal'),
    sdpType: payload.sdpType,
    session: nonEmptyString(payload.session, 'invalid_signal'),
    candidates: payload.candidates.map(parseCandidate),
    sharedTurnServer:
      payload.sharedTurnServer === undefined
        ? undefined
        : parseSharedTurnServer(payload.sharedTurnServer),
  }
}

function parseRoomMember(value: unknown): MultiplayerRoomMember {
  const member = record(value, 'invalid_room_member')
  exactKeys(member, ['peerId', 'accountId', 'displayName', 'status', 'joinedAt'])
  if (member.status !== 'negotiating' && member.status !== 'connected') {
    throw new MultiplayerProtocolError('invalid_room_member')
  }
  return {
    peerId: nonEmptyString(member.peerId, 'invalid_room_member'),
    accountId: nonEmptyString(member.accountId, 'invalid_room_member'),
    displayName:
      typeof member.displayName === 'string'
        ? member.displayName
        : (() => {
            throw new MultiplayerProtocolError('invalid_room_member')
          })(),
    status: member.status,
    joinedAt: nonNegativeInteger(member.joinedAt, 'invalid_room_member'),
  }
}

function parseRoomState(value: Record<string, unknown>): MultiplayerRoomState {
  exactKeys(value, [
    'type',
    'selfPeerId',
    'masterPeerId',
    'members',
    'status',
    'maxPeers',
    'revision',
  ])
  if (!Array.isArray(value.members)) throw new MultiplayerProtocolError('invalid_room_state')
  if (value.status !== 'open' && value.status !== 'waiting-master' && value.status !== 'closed') {
    throw new MultiplayerProtocolError('invalid_room_state')
  }
  const selfPeerId = nonEmptyString(value.selfPeerId, 'invalid_room_state')
  const masterPeerId = nonEmptyString(value.masterPeerId, 'invalid_room_state')
  const members = value.members.map(parseRoomMember)
  const peerIds = new Set(members.map((member) => member.peerId))
  const maxPeers = positiveInteger(value.maxPeers, 'invalid_room_state')
  if (
    maxPeers < 2 ||
    maxPeers > 16 ||
    peerIds.size !== members.length ||
    !peerIds.has(selfPeerId) ||
    !peerIds.has(masterPeerId) ||
    members.length > maxPeers
  ) {
    throw new MultiplayerProtocolError('invalid_room_state')
  }
  return {
    selfPeerId,
    masterPeerId,
    members,
    status: value.status,
    maxPeers,
    revision: nonNegativeInteger(value.revision, 'invalid_room_state'),
  }
}

function parseServerMessage(value: unknown): RoomServerMessage {
  const message = record(value, 'invalid_message')
  if (message.type === 'room-state') {
    return { type: 'room-state', ...parseRoomState(message) }
  }
  if (message.type === 'signal') {
    exactKeys(message, ['type', 'sender', 'payload'])
    return {
      type: 'signal',
      sender: nonEmptyString(message.sender, 'invalid_signal'),
      payload: parseSignalDescription(message.payload),
    }
  }
  if (message.type === 'error') {
    exactKeys(message, ['type', 'code'])
    return {
      type: 'error',
      code: nonEmptyString(message.code, 'invalid_error'),
    }
  }
  throw new MultiplayerProtocolError('unsupported_message')
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
  onroomstate = (_roomState: MultiplayerRoomState) => {},
  onuser = (_sender: string, _profile: ConnectionUserInfo) => {},
  onping = (_ping: number, _timestamp: number) => {},
  onsharedturnserver = (_server: RTCIceServer) => {},
) {
  let room: MultiplayerRoom | undefined
  let operation = 0

  async function enterGroup(
    admit: (profile: ConnectionUserInfo) => Promise<MultiplayerRoomAdmission>,
  ) {
    const currentOperation = ++operation
    let nextRoom: MultiplayerRoom | undefined
    try {
      await room?.quit()
      if (currentOperation !== operation) return
      room = undefined
      onleave()
      onstate('connecting')
      const localId = await idSignal.promise
      if (currentOperation !== operation) return
      const profile = getUserInfo()
      const admission = await admit(profile)
      nextRoom = new MultiplayerRoom(
        admission,
        localId,
        profile,
        peers,
        initiate,
        setRemoteDescription,
        roomApi,
        onsharedturnserver,
      )
      if (currentOperation !== operation) {
        await nextRoom.quit()
        return
      }
      room = nextRoom
      nextRoom.onstate = onstate
      nextRoom.onerror = onerror
      nextRoom.onroomstate = onroomstate
      nextRoom.onreset = () => {
        if (room === nextRoom) room = undefined
        onleave()
      }
      nextRoom.onuser = onuser
      nextRoom.onping = onping
      onjoin(admission)
      await nextRoom.connect()
      if (currentOperation !== operation) await nextRoom.quit()
    } catch (error) {
      if (currentOperation !== operation) return
      const failedRoom = room
      room = undefined
      await failedRoom?.quit()
      onleave()
      onerror(error)
      onstate('closed')
    }
  }

  function createGroup() {
    return enterGroup((profile) => roomApi.createRoom(profile.name, 8))
  }

  function joinGroup(roomId: string) {
    const normalizedRoomId = roomId.trim()
    if (!normalizedRoomId) {
      return Promise.reject(new Error('multiplayer_room_id_required'))
    }
    return enterGroup((profile) => roomApi.joinRoom(normalizedRoomId, profile.name, true))
  }

  async function leaveGroup() {
    operation++
    const current = room
    room = undefined
    if (current) await current.quit()
    onleave()
  }

  async function transferGroupMaster(peerId: string) {
    const current = room
    if (!current) throw new Error('multiplayer_room_missing')
    await current.transferMaster(peerId)
  }

  return {
    getGroup: () => room,
    createGroup,
    joinGroup,
    leaveGroup,
    transferGroupMaster,
  }
}

export class MultiplayerRoom {
  private socket: RoomSocket | undefined
  private closed = false
  private reconnecting = false
  private hasSnapshot = false
  private selfPeerId: string
  private masterPeerId = ''
  private members: MultiplayerRoomMember[] = []
  private revision = -1
  private status: MultiplayerRoomState['status'] = 'open'
  private maxPeers: number
  private readonly roomPeerIds = new Set<string>()
  private pendingTransfer:
    | {
        targetPeerId: string
        revision: number
        previousMasterPeerId: string
        resolve: () => void
        reject: (error: unknown) => void
        timeout: ReturnType<typeof setTimeout>
      }
    | undefined

  onstate = (_state: 'connecting' | 'connected' | 'closing' | 'closed') => {}
  onerror = (_error: unknown) => {}
  onroomstate = (_roomState: MultiplayerRoomState) => {}
  onreset = () => {}
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
    private readonly onSharedTurnServer: (server: RTCIceServer) => void = () => {},
    private readonly createSocket: (url: string) => RoomSocket = (url) => new WebSocket(url),
  ) {
    this.selfPeerId = admission.peerId
    this.maxPeers = admission.maxPeers
  }

  get roomId() {
    return this.admission.roomId
  }

  get role(): MultiplayerRole {
    if (!this.hasSnapshot) return this.admission.role
    return this.selfPeerId === this.masterPeerId ? 'master' : 'member'
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
        if (typeof event.data !== 'string') {
          this.protocolFailure(new MultiplayerProtocolError('non_text_message'))
          return
        }
        try {
          this.handle(parseServerMessage(JSON.parse(event.data)))
        } catch (error) {
          if (error instanceof MultiplayerProtocolError || error instanceof SyntaxError) {
            this.protocolFailure(
              error instanceof MultiplayerProtocolError
                ? error
                : new MultiplayerProtocolError('invalid_json'),
            )
          } else {
            this.reportError(error)
          }
        }
      }
      socket.onerror = (event) => {
        if (!opened && !settled) {
          settled = true
          reject(new Error('multiplayer_room_websocket_upgrade_failed', { cause: event }))
        } else {
          this.rejectPendingTransfer(
            new Error('multiplayer_room_transfer_socket_failed', { cause: event }),
          )
          this.reportError(event)
        }
      }
      socket.onclose = (event) => {
        if (socket !== this.socket) return
        this.socket = undefined
        if (!opened) {
          if (!settled) {
            settled = true
            if (this.closed) {
              resolve()
            } else {
              reject(new Error(`multiplayer_room_websocket_closed_before_open:${event.code}`))
            }
          }
          return
        }
        if (this.closed) return
        this.rejectPendingTransfer(
          new Error(`multiplayer_room_transfer_socket_closed:${event.code}`),
        )
        this.closeRoomPeers()
        if (event.code === 4000 || event.code === 4001 || event.code === 4003) {
          this.fail(new Error(`multiplayer_room_closed:${event.code}:${event.reason}`))
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
    sharedTurnServer?: RTCIceServer,
  ) {
    if (!this.hasSnapshot) throw new Error('multiplayer_room_state_unavailable')
    const receiver = this.members.find((member) => member.peerId === receiverId)
    if (
      !receiver ||
      receiverId === this.selfPeerId ||
      (this.role === 'member' && receiverId !== this.masterPeerId)
    ) {
      throw new Error('multiplayer_room_signal_target_invalid')
    }
    const session = this.peers.get(receiverId)?.id
    if (!session) throw new Error('multiplayer_room_peer_missing')
    const message = {
      type: 'signal',
      payload: {
        sdp,
        sdpType: type,
        session,
        candidates,
        ...(sharedTurnServer ? { sharedTurnServer } : {}),
      },
    }
    this.send(this.role === 'master' ? { ...message, receiver: receiverId } : message)
  }

  sendWho(_receiverId: string) {
    // Identity is exchanged over the authenticated metadata DataChannel.
  }

  setRtcState(remoteId: string, state: 'connected' | 'negotiating') {
    if (!this.hasSnapshot || this.role !== 'member' || remoteId !== this.masterPeerId) return
    if (this.socket?.readyState !== 1) return
    if (state === 'connected') {
      const peer = this.peers.get(remoteId)
      if (!peer || !peer.isDataChannelEstablished()) return
    }
    this.send({ type: 'rtc-state', state })
    this.onstate(state === 'connected' ? 'connected' : 'connecting')
  }

  removeMember(remoteId: string) {
    if (this.role !== 'master') throw new Error('multiplayer_room_not_master')
    const member = this.members.find((candidate) => candidate.peerId === remoteId)
    if (!member || member.peerId === this.selfPeerId) {
      throw new Error('multiplayer_room_remove_target_invalid')
    }
    this.send({ type: 'remove-member', peerId: remoteId })
    this.closeRoomPeer(remoteId)
  }

  isRoomPeer(peerId: string) {
    return (
      this.hasSnapshot &&
      peerId !== this.selfPeerId &&
      this.members.some((member) => member.peerId === peerId)
    )
  }

  canRemoveMember(peerId: string) {
    return !this.closed && this.role === 'master' && this.isRoomPeer(peerId)
  }

  async transferMaster(peerId: string): Promise<void> {
    if (this.pendingTransfer) throw new Error('multiplayer_room_transfer_pending')
    if (this.role !== 'master') throw new Error('multiplayer_room_not_master')
    const member = this.members.find((candidate) => candidate.peerId === peerId)
    if (!member || member.peerId === this.selfPeerId || member.status !== 'connected') {
      throw new Error('multiplayer_room_transfer_target_invalid')
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.rejectPendingTransfer(new Error('multiplayer_room_transfer_timeout'))
      }, TRANSFER_MASTER_TIMEOUT_MS)
      this.pendingTransfer = {
        targetPeerId: peerId,
        revision: this.revision,
        previousMasterPeerId: this.masterPeerId,
        resolve,
        reject,
        timeout,
      }
      try {
        this.send({ type: 'transfer-master', peerId })
      } catch (error) {
        this.rejectPendingTransfer(error)
      }
    })
  }

  private handle(message: RoomServerMessage) {
    if (message.type === 'room-state') {
      this.applyRoomState(message)
      return
    }
    if (message.type === 'signal') {
      if (this.hasSnapshot && this.role === 'member' && message.sender !== this.masterPeerId) {
        return
      }
      if (!this.hasSnapshot || !this.members.some((member) => member.peerId === message.sender)) {
        throw new MultiplayerProtocolError('unauthorized_signal_sender')
      }
      this.roomPeerIds.add(message.sender)
      const payload = message.payload
      if (payload.sharedTurnServer) {
        this.onSharedTurnServer(payload.sharedTurnServer)
      }
      this.applyRemoteDescription(
        {
          id: message.sender,
          session: payload.session,
          sdp: payload.sdp,
          candidates: payload.candidates,
        },
        payload.sdpType,
        payload.sharedTurnServer,
      )
      return
    }
    const error = new Error(`multiplayer_room_${message.code}`)
    if (
      message.code === 'master_target_unavailable' ||
      message.code === 'transfer_master_forbidden' ||
      message.code === 'invalid_master_target'
    ) {
      this.rejectPendingTransfer(error)
    }
    this.reportError(error)
  }

  private applyRoomState(roomState: MultiplayerRoomState) {
    if (roomState.selfPeerId !== this.admission.peerId) {
      throw new MultiplayerProtocolError('self_peer_id_mismatch')
    }
    if (roomState.revision < this.revision) return
    if (this.hasSnapshot && roomState.revision === this.revision) return
    if (roomState.status === 'closed') {
      this.finishClosedSnapshot()
      return
    }
    const previousMasterPeerId = this.masterPeerId
    const nextPeerIds = new Set(roomState.members.map((member) => member.peerId))
    for (const peerId of this.roomPeerIds) {
      if (!nextPeerIds.has(peerId)) this.closeRoomPeer(peerId)
    }
    if (
      (previousMasterPeerId && previousMasterPeerId !== roomState.masterPeerId) ||
      roomState.status === 'waiting-master'
    ) {
      this.closeRoomPeers()
    }
    this.selfPeerId = roomState.selfPeerId
    this.masterPeerId = roomState.masterPeerId
    this.members = roomState.members
    this.status = roomState.status
    this.maxPeers = roomState.maxPeers
    this.revision = roomState.revision
    this.hasSnapshot = true
    const self = roomState.members.find((member) => member.peerId === roomState.selfPeerId)!
    this.onstate(
      roomState.status === 'open' && (this.role === 'master' || self.status === 'connected')
        ? 'connected'
        : 'connecting',
    )
    this.emitRoomState()
    if (this.role === 'master' && roomState.status === 'open') {
      for (const member of roomState.members) this.ensureInitiated(member.peerId)
    }
    const pendingTransfer = this.pendingTransfer
    if (pendingTransfer && roomState.revision > pendingTransfer.revision) {
      if (roomState.masterPeerId === pendingTransfer.targetPeerId) {
        this.resolvePendingTransfer()
      } else if (roomState.masterPeerId !== pendingTransfer.previousMasterPeerId) {
        this.rejectPendingTransfer(new Error('multiplayer_room_transfer_superseded'))
      }
    }
  }

  private ensureInitiated(peerId: string) {
    if (
      this.role !== 'master' ||
      peerId === this.selfPeerId ||
      this.roomPeerIds.has(peerId) ||
      this.peers.get(peerId)
    ) {
      return
    }
    this.roomPeerIds.add(peerId)
    try {
      this.initiatePeer({ remoteId: peerId, initiate: true })
    } catch (error) {
      this.roomPeerIds.delete(peerId)
      throw error
    }
  }

  private closeRoomPeer(peerId: string) {
    for (const peer of this.peers.entries) {
      if (peer.remoteId !== peerId) continue
      peer.close()
      this.peers.remove(peer.id)
    }
    this.roomPeerIds.delete(peerId)
  }

  private closeRoomPeers() {
    const peerIds = new Set(this.roomPeerIds)
    if (this.hasSnapshot) {
      for (const member of this.members) {
        if (member.peerId !== this.selfPeerId) peerIds.add(member.peerId)
      }
    }
    for (const peerId of peerIds) this.closeRoomPeer(peerId)
    this.roomPeerIds.clear()
  }

  private emitRoomState() {
    this.onroomstate({
      selfPeerId: this.selfPeerId,
      masterPeerId: this.masterPeerId,
      members: this.members.map((member) => ({ ...member })),
      status: this.status,
      maxPeers: this.maxPeers,
      revision: this.revision,
    })
  }

  private applyAdmission(admission: MultiplayerRoomAdmission) {
    this.admission = admission
    this.selfPeerId = admission.peerId
    this.maxPeers = admission.maxPeers
    this.hasSnapshot = false
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
      const delays = [0, 500, 1_000, 2_000, 4_000, 5_000, 5_000, 5_000, 5_000]
      let lastError: unknown
      for (const delay of delays) {
        if (this.closed) return
        if (delay) {
          const jitter = Math.floor(Math.random() * 250)
          await new Promise((resolve) => setTimeout(resolve, delay + jitter))
        }
        try {
          const restored = await this.roomApi.joinRoom(this.roomId, this.profile.name, false)
          if (this.closed) return
          this.applyAdmission(restored)
          await this.connect()
          if (this.closed) return
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

  private protocolFailure(error: MultiplayerProtocolError) {
    this.fail(error, 1002, 'Protocol error')
  }

  private finishClosedSnapshot() {
    if (this.closed) return
    this.closed = true
    this.closeRoomPeers()
    this.rejectPendingTransfer(new Error('multiplayer_room_closed'))
    const socket = this.socket
    this.socket = undefined
    socket?.close(1000, 'Room closed')
    this.onstate('closed')
    this.onreset()
  }

  private resolvePendingTransfer() {
    const pending = this.pendingTransfer
    if (!pending) return
    this.pendingTransfer = undefined
    clearTimeout(pending.timeout)
    pending.resolve()
  }

  private rejectPendingTransfer(error: unknown) {
    const pending = this.pendingTransfer
    if (!pending) return
    this.pendingTransfer = undefined
    clearTimeout(pending.timeout)
    pending.reject(error)
  }

  private fail(error: unknown, code = 1000, reason = 'Room unavailable') {
    if (this.closed) return
    this.closed = true
    this.closeRoomPeers()
    this.rejectPendingTransfer(error)
    this.socket?.close(code, reason)
    this.socket = undefined
    this.onstate('closed')
    this.onreset()
    this.reportError(error)
  }

  private reportError(error: unknown) {
    this.onerror(error)
  }

  async quit() {
    if (this.closed) return
    const wasMaster = this.role === 'master'
    this.closed = true
    this.rejectPendingTransfer(new Error('multiplayer_room_transfer_cancelled'))
    this.onstate('closing')
    this.closeRoomPeers()
    if (wasMaster) {
      await this.roomApi.closeRoom(this.roomId).catch((error) => this.reportError(error))
    }
    this.socket?.close(1000, 'Client left')
    this.socket = undefined
    this.onstate('closed')
  }
}

export function dropPeerConnection(peers: Peers, room: MultiplayerRoom | undefined, id: string) {
  const peer = peers.get(id)
  if (!peer) return
  if (peer.remoteId && room?.canRemoveMember(peer.remoteId)) {
    room.removeMember(peer.remoteId)
    return
  }
  peer.close()
  peers.remove(peer.id)
}
