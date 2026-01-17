import { DownloadBaseOptions } from '@xmcl/file-transfer'
import { NetworkStatus } from '@xmcl/runtime-api'
import { InjectionKey } from '~/app'

export const kNetworkInterface: InjectionKey<NetworkInterface> = Symbol('NetworkInterface')
export const kDownloadOptions : InjectionKey<DownloadBaseOptions> = Symbol('DownloadOptions')

export interface NetworkInterface {
  getNetworkStatus(): NetworkStatus
  destroyPool(origin: string): Promise<void>
  onNetworkActivityChange(callback: (active: boolean) => void): void
}
