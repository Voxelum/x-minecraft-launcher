import { Dispatcher } from 'undici'
import { Duplex } from 'stream'

declare module 'undici' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Dispatcher {
    export interface DispatchOptions {
      /**
       * @default 'stale-while-revalidation'
       */
      cacheStrategy?: 'stale-while-revalidate' | 'cache-first' | 'network-only'
      connectTimeout?: number
      skipOverride?: boolean
    }
    export interface RequestOptions {
      connectTimeout?: number
    }
  }

  namespace Client {
    export interface Options {
      connectTimeout?: number
    }
  }
}
