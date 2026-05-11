import { AsyncLocalStorage } from 'async_hooks'
import type { Client } from '~/app'

interface RpcContextStore {
  client: Client
}

const rpcContext = new AsyncLocalStorage<RpcContextStore>()

/**
 * Wrap the body of a service-call dispatch so the called service method
 * (and anything it `await`s) can recover the originating renderer via
 * {@link getCurrentClient}.
 */
export function runWithCurrentClient<T>(client: Client, body: () => Promise<T>): Promise<T> {
  return rpcContext.run({ client }, body)
}

/**
 * The renderer client that initiated the current service-call, or
 * `undefined` when called outside an RPC dispatch (e.g. from internal
 * code paths). Window-scoped services use this to find the calling
 * `BrowserWindow`.
 */
export function getCurrentClient(): Client | undefined {
  return rpcContext.getStore()?.client
}
