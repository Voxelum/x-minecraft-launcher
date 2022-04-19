import { Server } from 'net'

export class ServerProxy {
  heartbeatAt: number
  constructor(
    readonly originalPort: number,
    public actualPort: number,
    public server: Server,
  ) {
    this.heartbeatAt = Date.now()
  }
}
