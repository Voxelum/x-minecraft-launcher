/* eslint-disable no-unused-vars */

// declare electron static for static file serving
/* eslint-disable no-unused-vars */

// declare electron static for static file serving

declare module '@node-rs/crc32-wasm32-wasi' {
  export function crc32(input: Buffer, crc?: number): number
  export function crc32c(input: Buffer, crc?: number): number
}

declare module 'create-desktop-shortcuts' {
  interface ShortcutOptions {
    windows?: {
      VBScriptPath?: string
      filePath: string
      outputPath: string
      name?: string
      icon?: string
      arguments?: string
    }
    linux?: {
      filePath: string
      outputPath: string
      name?: string
      icon?: string
      arguments?: string
    }
  }
  export default function createDesktopShortcuts(options: ShortcutOptions): void
}

declare module '*?worker' {
  import { Worker, WorkerOptions } from 'worker_threads'

  export const path: string
  /**
   * The helper to create the worker
   */
  export default function (options?: WorkerOptions): Worker
}

// declare module 'fs-extra' {
//   export * from 'fs-extra'
// }
declare module '*.png' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}
declare module '*.webp' {
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
