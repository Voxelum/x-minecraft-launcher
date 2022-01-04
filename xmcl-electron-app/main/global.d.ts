/* eslint-disable no-unused-vars */

// declare electron static for static file serving
/* eslint-disable no-unused-vars */

// declare electron static for static file serving

declare module '*?worker' {
  import { Worker, WorkerOptions } from 'worker_threads'
  /**
   * The helper to create the worker
   */
  export default function (options?: WorkerOptions): Worker
}

declare module '*.cs' {
  const content: string
  export default content
}

declare module 'nat-type-identifier' {
  function getNatType(options: { logsEnabled?: boolean; sampleCount?: number; stunHost?: string }): Promise<NatType>

  export type NatType =
    'Blocked' |
    'Open Internet' |
    'Full Cone' |
    'Symmetric UDP Firewall' |
    'Restric NAT' |
    'Restric Port NAT' |
    'Symmetric NAT'

  export = getNatType
}

declare module '/@renderer/*.html' {
  /**
   * The url of the page
   */
  const url: string
  export default url
}

declare module '/@renderer/*' {
  const noop: never
  export default noop
}

declare module '*.png' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}

declare module '/@preload/*' {
  /**
   * The path of the preload file
   */
  const path: string
  export default path
}

declare module '7zip-bin' {
  export const path7za: string
}
