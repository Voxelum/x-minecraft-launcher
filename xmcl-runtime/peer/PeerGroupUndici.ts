/* eslint-disable no-dupe-class-members */
// import EventSource from 'eventsource'
import EventEmitter from 'events'
import { DescriptionType } from 'node-datachannel'
import { createPromiseSignal, PromiseSignal } from '@xmcl/runtime-api'
import { WebSocket } from 'undici'

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
}

export interface PeerGroup {
  emit(eventName: 'error', error: unknown): boolean
  emit(eventName: 'state', state: 'connecting' | 'connected' | 'closing' | 'closed'): boolean
  emit(eventName: 'heartbeat', sender: string): boolean
  emit(eventName: 'descriptor', sender: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>): boolean

  on(eventName: 'error', handler: (error: unknown) => void): this
  on(eventName: 'state', handler: (state: 'connecting' | 'connected' | 'closing' | 'closed') => void): this
  on(eventName: 'heartbeat', handler: (sender: string) => void): this
  on(eventName: 'descriptor', handler: (sender: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>) => void): this

  once(eventName: 'error', handler: (error: unknown) => void): this
  once(eventName: 'state', handler: (state: 'connecting' | 'connected' | 'closing' | 'closed') => void): this
  once(eventName: 'heartbeat', handler: (sender: string) => void): this
  once(eventName: 'descriptor', handler: (sender: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>) => void): this
}

function timeout(n: number) {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => resolve(), n)
  })
}

function convertUUIDToUint8Array(id: string) {
  const ints = id.replace(/-/g, '').match(/.{2}/g)!.map((v) => parseInt(v, 16))
  return new Uint8Array(ints)
}

export class PeerGroup extends EventEmitter {
  private messageId = 0
  private socket: WebSocket
  private closed = false
  public state: 'connecting' | 'connected' | 'closing' | 'closed'

  readonly signals: Record<number, PromiseSignal<void>> = {}

  private messageQueue: RelayPeerMessage[] = []
  private idBinary: Uint8Array

  #heartbeat = setInterval(() => {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(this.idBinary)
    }
  }, 4_000)

  constructor(readonly groupId: string, readonly id: string) {
    super()
    this.idBinary = convertUUIDToUint8Array(id)
    this.socket = new WebSocket(`wss://api.xmcl.app/group/${groupId}`)
    this.state = 'connecting'
    this.#initiate()
  }

  #initiate() {
    const { id, groupId, socket } = this

    socket.onopen = () => {
      this.state = 'connected'
      this.emit('state', this.state)
      for (let i = this.messageQueue.shift(); i; i = this.messageQueue.shift()) {
        this.send(i)
      }
    }
    // socket.on('ping', heartbeat)
    socket.onmessage = (event) => {
      const { data } = event
      if (data instanceof Uint8Array) {
        const id = [...data]
          .map((b) => ('00' + b.toString(16)).slice(-2))
          .join('')
          .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
        if (id !== this.id) {
          this.emit('heartbeat', id)
        }
        return
      }
      if (typeof data === 'string') {
        try {
          const payload = JSON.parse(data.toString()) as RelayPeerMessage
          if (payload.receiver !== id) {
            return
          }
          if (payload.type === 'DESCRIPTOR') {
            this.send({
              type: 'DESCRIPTOR-ECHO',
              receiver: payload.sender,
              sender: id,
              id: payload.id,
            })
            this.emit('descriptor', payload.sender, payload.sdp, payload.sdpType, payload.candidates)
          } else if (payload.type === 'DESCRIPTOR-ECHO') {
            const signal = this.signals[payload.id]
            if (signal) {
              signal.resolve()
              delete this.signals[payload.id]
            }
          }
        } catch (e) {
          this.emit('error', e)
        }
      }
    }
    socket.onerror = (e) => {
      this.emit('error', e)
    }
    socket.onclose = (e) => {
      const { wasClean, reason, code } = e
      if (!this.closed) {
        // Try to reconnect as this is closed unexpected
        this.socket = new WebSocket(`wss://api.xmcl.app/group/${groupId}`)
        this.state = 'connecting'
        this.#initiate()
        this.emit('state', this.state)
      } else {
        this.state = 'closed'
        this.emit('state', this.state)
      }
    }
  }

  wait(messageId: number): Promise<void> {
    this.signals[messageId] = createPromiseSignal()
    return this.signals[messageId].promise
  }

  async sendLocalDescription(id: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>) {
    const messageId = this.messageId++
    while (true) {
      try {
        this.send({
          type: 'DESCRIPTOR',
          receiver: id,
          sdp,
          sdpType: type,
          sender: this.id,
          candidates,
          id: messageId,
        })
        const responsed = await Promise.race([
          this.wait(messageId).then(() => true, () => false),
          timeout(4_000).then(() => false), // wait 4 seconds for response
        ])
        if (responsed) {
          return
        }
      } catch (e) {
        this.emit('error', e)
      }
    }
  }

  send(message: RelayPeerMessage) {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  quit() {
    this.closed = true
    this.socket.close()
    this.state = 'closing'
    clearInterval(this.#heartbeat)
    this.emit('state', this.state)
  }
}
