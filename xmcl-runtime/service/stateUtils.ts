import { MutableState } from '@xmcl/runtime-api'
import EventEmitter from 'events'

export const kStateKey = '__state__'

export function isStateObject(v: object): v is MutableState<any> {
  return v && typeof v === 'object' && kStateKey in v
}

export class MutableStateImpl {
  constructor(private listener: EventEmitter, public revalidate: () => void) { }

  subscribe(key: string, listener: (payload: any) => void) {
    this.listener.addListener(key, listener)
    return this
  }

  unsubscribe(key: string, listener: (payload: any) => void) {
    this.listener.removeListener(key, listener)
    return this
  }

  subscribeAll(listener: (payload: any) => void) {
    this.listener.addListener('*', listener)
    return this
  }

  unsubscribeAll(listener: (payload: any) => void) {
    this.listener.removeListener('*', listener)
    return this
  }
}
