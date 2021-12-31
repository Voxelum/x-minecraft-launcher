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

declare module 'nat-api' {
  class NatAPI {
    map(publicPort: number, callback: (err?: Error) => void): void
    map(publicPort: number, privatePort: number, callback: (err?: Error) => void): void
    map(mapOptions: MapOptions, callback: (err?: Error) => void): void

    unmap(publicPort: number, callback: (err?: Error) => void): void

    externalIp(callback: (err: Error | undefined, ip: string) => void): void
    destroy(): void
  }

  export interface MapOptions {
    publicPort?: number
    privatePort?: number
    ttl?: number
    protocol?: 'TCP' | 'UDP' | null
    description?: string
  }

  export interface NatOptions {
    /**
     * Time to live of each port mapping in seconds (default: 1200)
     */
    ttl?: number
    /**
     * Refresh all the port mapping to keep them from expiring (default: true)
     */
    autoUpdate?: boolean
    /**
     * Default gateway (default: null)
     */
    gateway?: string
    /**
     * Enable PMP (default: false)
     */
    enablePMP?: boolean
  }

  export = NatAPI
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
