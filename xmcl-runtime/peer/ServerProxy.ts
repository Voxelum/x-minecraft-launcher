import { Server } from 'net'

export class ServerProxy {
  actualPortValue: number | undefined
  constructor(
    readonly originalPort: number,
    public actualPort: Promise<number>,
    public server: Server,
  ) {
    actualPort.then((val) => { this.actualPortValue = val })
  }
}
