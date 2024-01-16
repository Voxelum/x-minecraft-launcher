import { Channel, Handshake, Ping, ServerQuery, ServerStatus, Status, createChannel } from '@xmcl/client'

class Client {
  status: Status | undefined
  ping: number = 0
  constructor(readonly channel: Channel, readonly port: number) { }
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
      const infos = Object.values(this.#clients).filter(c => c.status).map(c => ({ port: c.port, motd: JSON.stringify(c.status) }))
      broadcast(infos)
    }, 5500)
    this.#pingInterval = setInterval(() => {
      for (const client of Object.values(this.#clients)) {
        client.channel.send(new ServerQuery())
        client.channel.send(new Ping(), { time: BigInt(Date.now()) })
      }
    }, 5500)
  }

  get ports() {
    // i7.me.cn
    return Object.keys(this.#clients).map(v => Number(v))
  }

  dispose() {
    clearInterval(this.#sendPacketInterval)
    clearInterval(this.#pingInterval)
    for (const client of Object.values(this.#clients)) {
      client.channel.disconnect()
      delete this.#clients[client.port]
    }
  }

  async expose(port: number, protocol: number) {
    const chan = createChannel()
    const client = new Client(chan, port)
    await chan.listen({
      host: '127.0.0.1',
      port,
    })
    chan.send(new Handshake(), {
      protocolVersion: protocol,
      serverAddress: '127.0.0.1',
      serverPort: port,
      nextState: 1,
    })
    chan.state = 'status'
    chan.send(new ServerQuery())
    chan.onPacket(Ping, ({ time }) => {
      client.ping = Number(BigInt(Date.now()) - time)
    })
    chan.onPacket(ServerStatus, ({ status }) => {
      client.status = status
    })
    this.#clients[port] = client
  }

  async unexpose(port: number) {
    const client = this.#clients[port]
    if (client) {
      delete this.#clients[port]
      return client.channel.disconnect()
    }
  }
}
