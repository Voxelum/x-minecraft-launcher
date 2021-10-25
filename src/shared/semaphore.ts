import { GenericEventEmitter } from './events'

interface SemaphoreChannelEventMap {
  'aquire': string[] | string
  'release': string[] | string
}

export interface SemaphoreChannel extends GenericEventEmitter<SemaphoreChannelEventMap> {
  subscribe(): Promise<Record<string, number>>
  unsubscribe(): Promise<void>
}
