import { Agent, Dispatcher } from 'undici'
import { InjectionKey } from '../util/objectRegistry'

export const kNetworkInterface: InjectionKey<NetworkInterface> = Symbol('NetworkInterface')

export interface NetworkInterface {
  registerAPIFactoryInterceptor(interceptor: (origin: URL, options: Agent.Options) => Dispatcher | undefined): Dispatcher
  registerDispatchInterceptor(interceptor: (opts: Dispatcher.DispatchOptions) => void | Promise<void>): void
}
