import type { IceServer } from 'node-datachannel'
import { InjectionKey } from '~/app'

export interface IceServerProvider {
  getIceServers(allowTurn?: boolean): IceServer[]
}

export const kIceServerProvider: InjectionKey<IceServerProvider> = Symbol('IceServerProvider')
