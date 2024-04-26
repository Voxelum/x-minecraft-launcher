import type { IceServer } from 'node-datachannel'
import { InjectionKey } from '~/app'

export interface IceServerProvider {
  getIceServers(): IceServer[]
  getTurnServers(): IceServer[]
  setValidIceServers(servers: IceServer[]): void
  getValidIceServers(): IceServer[]
}

export const kIceServerProvider: InjectionKey<IceServerProvider> = Symbol('IceServerProvider')
