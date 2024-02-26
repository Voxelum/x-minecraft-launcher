import { Agent, Dispatcher } from 'undici'
import { InjectionKey } from '~/app'
import { DownloadBaseOptions } from '@xmcl/file-transfer'
import { PoolStats } from '@xmcl/runtime-api'

export const kNetworkInterface: InjectionKey<NetworkInterface> = Symbol('NetworkInterface')
export const kDownloadOptions : InjectionKey<DownloadBaseOptions> = Symbol('DownloadOptions')

export interface NetworkInterface {
  registerClientFactoryInterceptor(interceptor: (origin: URL, options: Agent.Options) => Dispatcher | undefined): Dispatcher
  registerOptionsInterceptor(interceptor: (opts: Dispatcher.DispatchOptions) => void | Promise<void>): void
  getDownloadAgentStatus(): Record<string, PoolStats>
}
