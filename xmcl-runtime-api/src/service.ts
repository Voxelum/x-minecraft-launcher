/* eslint-disable no-dupe-class-members */
import { GenericEventEmitter } from './events'
import { ServiceKey } from './services/Service'

interface SyncableEventMap {
  commit: {
    mutation: { payload: any; type: string }
    id: number
  }
}

/**
 * Low level syncable channel to communicate with server to sync state.
 */
export interface SyncableStateChannel<T> extends GenericEventEmitter<SyncableEventMap> {
}

/**
 * The stateless service channel. Since the limitation of the context isolation, you need to build state by yourself.
 */
export type ServiceChannel<T> = {
  readonly key: ServiceKey<T>
  /**
   * Call a method of the service.
   * @param method The method name
   * @param payload The method payload
   */
  call<M extends keyof T, MT = T[M]>(
    method: M,
    ...payload: MT extends (...args: infer A) => any ? A : never
  ): Promise<MT extends (...args: any) => any ? ReturnType<MT> : never>
} & GenericEventEmitter<SyncableEventMap>

export interface StateMetadata {
  /**
   * The name of the state
   */
  name: string
  /**
   * The constructor of the state
   */
  constructor: () => object
  /**
   * The methods of the state
   */
  methods: [string, (this: any, ...args: any[]) => any][]
  prototype: object
}

export interface ServiceChannels {
  /**
   * The low level api to open a channel to a specific service.
   *
   * Notice you need to wrap this object to create a full stateful service!
   * This design is due the the limitation of context isolation.
   *
   * @param serviceKey The service key
   */
  open<T>(serviceKey: ServiceKey<T>): ServiceChannel<T>

  // deref(state: MutableState<any>): void
}
