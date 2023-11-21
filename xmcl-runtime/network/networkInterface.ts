import { Agent, Dispatcher } from 'undici'
import { InjectionKey } from '~/app'
import { DownloadBaseOptions } from '@xmcl/file-transfer'

export const kNetworkInterface: InjectionKey<NetworkInterface> = Symbol('NetworkInterface')
export const kDownloadOptions : InjectionKey<DownloadBaseOptions> = Symbol('DownloadOptions')

export interface NetworkInterface {
  registerAPIFactoryInterceptor(interceptor: (origin: URL, options: Agent.Options) => Dispatcher | undefined): Dispatcher
  registerDispatchInterceptor(interceptor: (opts: Dispatcher.DispatchOptions) => void | Promise<void>): void
}
