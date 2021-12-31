export interface GenericEventEmitter<EventMap> {
  on<K extends keyof EventMap>(channel: K, listener: (event: EventMap[K]) => void): this
  once<K extends keyof EventMap>(channel: K, listener: (event: EventMap[K]) => void): this
  removeListener<K extends keyof EventMap>(channel: K, listener: (...args: any[]) => void): this
}
