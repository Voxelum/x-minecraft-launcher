export interface GenericEventEmitter<EventMap> {
  on<K extends keyof EventMap>(channel: K, listener: (event: EventMap[K]) => void): GenericEventEmitter<EventMap>
  once<K extends keyof EventMap>(channel: K, listener: (event: EventMap[K]) => void): GenericEventEmitter<EventMap>
  removeListener<K extends keyof EventMap>(channel: K, listener: (...args: any[]) => void): GenericEventEmitter<EventMap>
}
