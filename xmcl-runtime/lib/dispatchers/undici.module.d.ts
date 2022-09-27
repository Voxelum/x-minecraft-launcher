import { Dispatcher } from 'undici'

declare module 'undici' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Dispatcher {
    export interface DispatchOptions {
      /**
       * @default 'stale-while-revalidation'
       */
      cacheStrategy?: 'stale-while-revalidate' | 'cache-first' | 'network-only'
    }
  }
}
