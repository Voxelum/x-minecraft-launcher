/* eslint-disable no-unused-vars */

// declare electron static for static file serving
/* eslint-disable no-unused-vars */

// declare electron static for static file serving

declare module '*?worker' {
  import { Worker, WorkerOptions } from 'worker_threads'

  export const path: string
  /**
   * The helper to create the worker
   */
  export default function (options?: WorkerOptions): Worker
}

declare module '*.png' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}
declare module '*.svg' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}

declare module '*.gif' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}

declare module '*.vbs' {
  const path: string
  export default path
}

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
