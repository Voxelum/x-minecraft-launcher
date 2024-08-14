import { ConnectionUserInfo, GameProfileAndTexture, PromiseSignal, createPromiseSignal } from '@xmcl/runtime-api'
import { setTimeout } from 'timers/promises'
import { PeerSession } from './connection'
import type { InitiateOptions, Peers } from './multiplayerImpl'

type DescriptionType = string

export interface TransferDescription {
  session: string
  id: string
  sdp: string
  candidates: Array<{ candidate: string; mid: string }>
}

type RelayPeerMessage = {
  type: 'DESCRIPTOR-ECHO'
  receiver: string
  sender: string
  id: number
} | {
  type: 'DESCRIPTOR'
  receiver: string
  sender: string
  sdp: string
  candidates: Array<{ candidate: string; mid: string }>
  sdpType: DescriptionType
  id: number
  iceServer?: RTCIceServer
  iceServers?: RTCIceServer[]
} | {
  type: 'WHO'
  receiver: string
  sender: string
} | {
  type: 'ME'
  sender: string
  profile: ConnectionUserInfo
}

function convertUUIDToUint8Array(id: string) {
  const ints = id.replace(/-/g, '').match(/.{2}/g)!.map((v) => parseInt(v, 16))
  return new Uint8Array(ints)
}

export function createPeerGroup(
  peers: Peers,
  getUserInfo: () => ConnectionUserInfo,
  initiate: (option: InitiateOptions) => void,
  setRemoteDescription: (d: TransferDescription, type: 'offer' | 'answer', t?: RTCIceServer, all?: RTCIceServer[]) => Promise<string>,
  onstate = (state: 'connecting' | 'connected' | 'closing' | 'closed') => { },
  onerror = (e: unknown) => { },
  onjoin = (groupId: string) => { },
  onleave = () => { },
  onuser = (sender: string, profile: ConnectionUserInfo) => { },
) {
  let _group: PeerGroup | undefined
  let _id = ''
  const init = createPromiseSignal<void>()

  const cached = localStorage.getItem('peerGroup')
  if (cached && typeof cached === 'string') {
    console.log('Cached group', cached)
    joinGroup(cached)
  }

  async function joinGroup(groupId?: string) {
    console.log('Join group', groupId)
    if (!groupId) {
      const buf = new Uint16Array(1)
      window.crypto.getRandomValues(buf)
      groupId = (getUserInfo()?.name ?? '') + '@' + buf[0]
    }
    localStorage.setItem('peerGroup', groupId)
    _group = new PeerGroup(groupId, () => getUserInfo())

    _group.onheartbeat = (sender) => {
      console.log(`Get heartbeat from ${sender}`)
      const peer = peers.get(sender)
      // Ask sender to connect to me :)
      if (!peer) {
        if (_id.localeCompare(sender) > 0) {
          console.log(`Not found the ${sender} during heartbeat. Initiate new connection`)
          // Only if my id is greater than other's id, we try to initiate the connection.
          // This will have a total order in the UUID random space

          // Try to connect to the sender
          initiate({ remoteId: sender, initiate: true })
        }
      }
    }
    _group.ondescriptor = async (sender, sdp, type, candidates, iceServer, allIceServers) => {
      setRemoteDescription({
        id: sender,
        session: '',
        sdp,
        candidates,
      }, type as any, iceServer, allIceServers)
    }
    _group.onuser = onuser
    _group.onstate = onstate
    _group.onerror = onerror
    await init.promise
    _group.initialize(_id)

    onstate(_group.state)
    onjoin(groupId)
  }
  function leaveGroup() {
    _group?.quit()
    _group = undefined
    localStorage.setItem('peerGroup', '')
    onleave()
  }

  return {
    setId: (id: string) => {
      _id = id
      init.resolve()
      _group?.initialize(id)
    },
    getGroup: () => _group,
    joinGroup,
    leaveGroup,
  }
}

export class PeerGroup {
  private messageId = 0
  private socket: WebSocket
  public state: 'connecting' | 'connected' | 'closing' | 'closed'

  readonly signals: Record<number, PromiseSignal<void>> = {}

  #closed = false
  #messageQueue: RelayPeerMessage[] = []
  #id = ''
  #heartbeat: ReturnType<typeof setInterval> | undefined

  onstate = (state: 'connecting' | 'connected' | 'closing' | 'closed') => { }
  onheartbeat = (sender: string) => { }
  ondescriptor = (sender: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>, iceServer?: RTCIceServer, allServers?: RTCIceServer[]) => { }
  onerror: (error: unknown) => void = () => { }
  onuser = (sender: string, profile: ConnectionUserInfo) => { }

  constructor(readonly groupId: string, readonly gameProfile: () => GameProfileAndTexture) {
    this.socket = new WebSocket(`wss://api.xmcl.app/group/${groupId}`)
    this.state = 'connecting'
  }

  initialize(id: string) {
    if (this.#id) {
      return
    }
    this.#id = id
    const idBinary = convertUUIDToUint8Array(id)
    this.#heartbeat = setInterval(() => {
      if (this.socket.readyState === this.socket.OPEN) {
        this.socket.send(idBinary)
      }
    }, 4_000)
    this.#initiate()
  }

  #initiate() {
    const { groupId, socket } = this
    const id = this.#id

    socket.onopen = () => {
      this.state = 'connected'
      this.onstate?.(this.state)
      for (let i = this.#messageQueue.shift(); i; i = this.#messageQueue.shift()) {
        this.send(i)
      }
    }
    // socket.onping = heartbeat)
    socket.onmessage = (event) => {
      const { data } = event
      const onHeartbeat = (data: Uint8Array) => {
        const id = [...data]
          .map((b) => ('00' + b.toString(16)).slice(-2))
          .join('')
          .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
        if (id !== this.#id) {
          this.onheartbeat?.(id)
        }
      }
      if (data instanceof Blob) {
        // Blob to Uint8Array
        data.arrayBuffer().then(data => new Uint8Array(data))
          .then(onHeartbeat)
        return
      }
      if (data instanceof Uint8Array) {
        onHeartbeat(data)
        return
      }
      if (typeof data === 'string') {
        try {
          const payload = JSON.parse(data.toString()) as RelayPeerMessage
          if ('receiver' in payload && payload.receiver !== id) {
            return
          }
          if (payload.sender === id) {
            return
          }
          if (payload.type === 'DESCRIPTOR') {
            this.send({
              type: 'DESCRIPTOR-ECHO',
              receiver: payload.sender,
              sender: id,
              id: payload.id,
            })
            this.ondescriptor?.(payload.sender, payload.sdp, payload.sdpType, payload.candidates, payload.iceServer, payload.iceServers)
          } else if (payload.type === 'DESCRIPTOR-ECHO') {
            const signal = this.signals[payload.id]
            if (signal) {
              signal.resolve()
              delete this.signals[payload.id]
            }
          } else if (payload.type === 'WHO') {
            // Send who am I
            const profile = this.gameProfile()
            this.send({
              type: 'ME',
              sender: id,
              profile: {
                ...profile,
                avatar: profile.textures.SKIN.url,
              },
            })
          } else if (payload.type === 'ME') {
            this.onuser?.(payload.sender, payload.profile)
          }
        } catch (e) {
          this.onerror?.(e)
        }
      }
    }
    socket.onerror = (e) => {
      this.onerror?.(e)
    }
    socket.onclose = (e) => {
      const { wasClean, reason, code } = e
      if (!this.#closed) {
        // Try to reconnect as this is closed unexpected
        this.state = 'connecting'
        this.onstate?.(this.state)
        setTimeout(1000).then(() => {
          this.socket = new WebSocket(`wss://api.xmcl.app/group/${groupId}`)
          this.#initiate()
        })
      } else {
        this.state = 'closed'
        this.onstate?.(this.state)
      }
    }
  }

  wait(messageId: number): Promise<void> {
    this.signals[messageId] = createPromiseSignal()
    return this.signals[messageId].promise
  }

  async sendLocalDescription(receiverId: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>, iceServer: RTCIceServer, iceServers: RTCIceServer[]) {
    const messageId = this.messageId++
    while (true) {
      try {
        this.send({
          type: 'DESCRIPTOR',
          receiver: receiverId,
          sdp,
          sdpType: type,
          sender: this.#id,
          candidates,
          id: messageId,
          iceServer,
          iceServers,
        })
        const responsed = await Promise.race([
          this.wait(messageId).then(() => true, () => false),
          setTimeout(4_000).then(() => false), // wait 4 seconds for response
        ])
        if (responsed) {
          return
        }
      } catch (e) {
        this.onerror?.(e)
      }
    }
  }

  async sendWho(receiverId: string) {
    this.send({
      type: 'WHO',
      receiver: receiverId,
      sender: this.#id,
    })
  }

  send(message: RelayPeerMessage) {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(message))
    } else {
      this.#messageQueue.push(message)
    }
  }

  quit() {
    this.#closed = true
    this.socket.close()
    this.state = 'closing'
    clearInterval(this.#heartbeat)
    this.onstate?.(this.state)
  }
}
