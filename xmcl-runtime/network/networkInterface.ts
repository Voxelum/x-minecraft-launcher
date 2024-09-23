import { DownloadBaseOptions } from '@xmcl/file-transfer'
import { PoolStats } from '@xmcl/runtime-api'
import { Dispatcher } from 'undici'
import { InjectionKey } from '~/app'

export const kNetworkInterface: InjectionKey<NetworkInterface> = Symbol('NetworkInterface')
export const kDownloadOptions : InjectionKey<DownloadBaseOptions> = Symbol('DownloadOptions')

export interface NetworkInterface {
  registerOptionsInterceptor(interceptor: (opts: Dispatcher.DispatchOptions) => void): void
  getDownloadAgentStatus(): Record<string, PoolStats>
  destroyPool(origin: string): Promise<void>
}
