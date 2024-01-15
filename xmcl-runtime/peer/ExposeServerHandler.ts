import { Channel, createChannel } from '@xmcl/client'

export class ExposeServerHandler {
  #channels: Record<number, Channel> = {}
  #sendPacketInterval: ReturnType<typeof setInterval>
  #pingInterval: ReturnType<typeof setInterval>

  constructor() {
    this.#sendPacketInterval = setInterval(() => {

    }, 5500)
    this.#pingInterval = setInterval(() => {
    }, 5500)
  }

  get ports() {
    // i7.me.cn
    return Object.keys(this.#channels).map(v => Number(v))
  }

  expose(port: number) {
    this.#channels[port] = createChannel()
  }

  async unexpose(port: number) {
    const chan = this.#channels[port]
    if (chan) {
      return chan.disconnect()
    }
  }
}
