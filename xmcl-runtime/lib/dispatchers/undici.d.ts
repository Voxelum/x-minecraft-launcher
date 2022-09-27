declare module 'undici/lib/core/symbols' {
  export const kDestroy: unique symbol
  export const kClose: unique symbol
  export const kDispatch: unique symbol
  export const kRunning: unique symbol
  export const kClients: unique symbol
}

declare module 'undici/lib/dispatcher-base' {
  import { Dispatcher } from 'undici'
  import { kClose, kDestroy, kRunning } from 'undici/lib/core/symbols'

  declare abstract class DispatcherBase extends Dispatcher {
    readonly destroyed: boolean
    readonly closed: boolean

    get [kRunning](): number

    abstract [kClose](): Promise<void>
    abstract [kDestroy](err?: any): Promise<void>
  }

  export default DispatcherBase
}
