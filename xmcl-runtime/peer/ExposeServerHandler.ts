import { Channel, Handshake, Ping, Pong, ServerQuery, ServerStatus, Status, createChannel } from '@xmcl/client'
import { createPromiseSignal } from '@xmcl/runtime-api'
import { toFormattedString } from '@xmcl/text-component'
import { setTimeout } from 'timers/promises'

class Client {
  status: Status | undefined
  ping: number = 0
  channel: Channel | undefined
  constructor(readonly port: number, readonly protocol: number) { }
}
export class ExposeServerHandler {
  #clients: Record<number, Client> = {}
  #sendPacketInterval: ReturnType<typeof setInterval>
  #pingInterval: ReturnType<typeof setInterval>

  constructor(broadcast: (infos: Array<{
    motd: string
    port: number
  }>) => void) {
    this.#sendPacketInterval = setInterval(() => {
      const infos = Object.values(this.#clients).filter(c => c.status).map(c => ({
        port: c.port,
        motd: typeof c.status?.description === 'object' ? toFormattedString(c.status.description) : '',
      }))
      broadcast(infos)
    }, 5500)
    this.#pingInterval = setInterval(async () => {
      for (const client of Object.values(this.#clients)) {
        const signal = createPromiseSignal()
        try {
          const chan = createChannel()
          await chan.listen({
            host: '127.0.0.1',
            port: client.port,
          })
          chan.onPacket(Pong, ({ ping }) => {
            client.ping = Number(BigInt(Date.now()) - ping)
          })
          chan.onPacket(ServerStatus, ({ status }) => {
            client.status = status
            signal.resolve()
          })
          chan.send(new Handshake(), {
            protocolVersion: client.protocol,
            serverAddress: '127.0.0.1',
            serverPort: client.port,
            nextState: 1,
          })
          chan.state = 'status'
          chan.send(new ServerQuery())
          const connected = await Promise.race([signal.promise.then(() => true), setTimeout(3000).then(() => false)])
          if (!connected) {
            chan.disconnect()
          } else {
            chan.send(new Ping())
          }
        } catch (e) {
        }
      }
    }, 5500)
  }

  get ports() {
    return Object.keys(this.#clients).map(v => Number(v))
  }

  dispose() {
    clearInterval(this.#sendPacketInterval)
    clearInterval(this.#pingInterval)
    for (const client of Object.values(this.#clients)) {
      client.channel?.disconnect()
      delete this.#clients[client.port]
    }
  }

  async expose(port: number, protocol: number) {
    const chan = createChannel()
    const client = new Client(port, protocol)
    this.#clients[port] = client
  }

  async unexpose(port: number) {
    const client = this.#clients[port]
    if (client) {
      delete this.#clients[port]
      return client.channel?.disconnect()
    }
  }
}
