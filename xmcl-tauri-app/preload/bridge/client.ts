import {
  BRIDGE_PATH,
  deserializeError,
  EventMessage,
  ServerMessage,
} from '../../bridge/protocol'

export interface BridgeConfig {
  port: number
  token: string
  dev: boolean
}

type EventListener = (...args: unknown[]) => void

/**
 * Webview side of the local bridge.
 *
 * Reconnects on its own because the shell restarts the sidecar on the same
 * port and token, so a crashed runtime does not require reloading the page.
 * Calls issued while the socket is down are queued; calls already in flight
 * reject, matching what a renderer sees when the Electron main process dies.
 */
export class BridgeClient {
  private socket: WebSocket | undefined
  private sequence = 0
  private readonly pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
  private readonly queue: string[] = []
  private readonly listeners = new Map<string, Set<EventListener>>()
  private attempt = 0

  constructor(private readonly config: BridgeConfig) {
    this.connect()
  }

  invoke(channel: string, ...args: unknown[]): Promise<any> {
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.write(JSON.stringify({ t: 'invoke', id, channel, args }))
    })
  }

  send(channel: string, ...args: unknown[]) {
    this.write(JSON.stringify({ t: 'send', channel, args }))
  }

  on(channel: string, listener: EventListener) {
    let set = this.listeners.get(channel)
    if (!set) {
      set = new Set()
      this.listeners.set(channel, set)
    }
    set.add(listener)
    return () => set!.delete(listener)
  }

  private write(payload: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload)
    } else {
      this.queue.push(payload)
    }
  }

  private connect() {
    const { port, token } = this.config
    const socket = new WebSocket(`ws://127.0.0.1:${port}${BRIDGE_PATH}?token=${encodeURIComponent(token)}`)
    this.socket = socket
    socket.addEventListener('open', () => {
      this.attempt = 0
      for (const payload of this.queue.splice(0)) socket.send(payload)
    })
    socket.addEventListener('message', (event) => this.receive(event.data))
    socket.addEventListener('close', () => {
      if (this.socket === socket) this.socket = undefined
      this.rejectPending(new Error('The launcher runtime connection was closed'))
      // Backoff, but stay eager: the shell needs at most a few hundred ms to
      // bring the sidecar back on the same port.
      this.attempt += 1
      setTimeout(() => this.connect(), Math.min(200 * this.attempt, 2000))
    })
    socket.addEventListener('error', () => socket.close())
  }

  private rejectPending(error: Error) {
    for (const { reject } of this.pending.values()) reject(error)
    this.pending.clear()
  }

  private receive(data: unknown) {
    if (typeof data !== 'string') return
    let message: ServerMessage
    try {
      message = JSON.parse(data)
    } catch {
      return
    }
    if (message.t === 'event') return this.emit(message)
    const entry = this.pending.get(message.id)
    if (!entry) return
    this.pending.delete(message.id)
    if (message.ok) entry.resolve(message.result)
    else entry.reject(deserializeError(message.error!))
  }

  private emit(message: EventMessage) {
    const set = this.listeners.get(message.channel)
    if (!set) return
    for (const listener of [...set]) {
      try {
        listener(...message.args)
      } catch (e) {
        console.error(`[bridge] listener of '${message.channel}' threw`, e)
      }
    }
  }
}

export function getBridgeConfig(): BridgeConfig {
  const config = (globalThis as { __XMCL_BRIDGE__?: BridgeConfig }).__XMCL_BRIDGE__
  if (!config) {
    throw new Error('__XMCL_BRIDGE__ is missing: the shell did not inject the bridge configuration')
  }
  return config
}

export const bridge = new BridgeClient(getBridgeConfig())
