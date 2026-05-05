// https://www.npmjs.com/package/typed-emitter

export interface TypedEmitter<
  eventName extends {
    [eventName: string]: (...args: any[]) => void
  },
> {
  addListener<E extends keyof eventName>(event: E, listener: eventName[E]): this
  on<E extends keyof eventName>(event: E, listener: eventName[E]): this
  once<E extends keyof eventName>(event: E, listener: eventName[E]): this
  prependListener<E extends keyof eventName>(event: E, listener: eventName[E]): this
  prependOnceListener<E extends keyof eventName>(event: E, listener: eventName[E]): this

  off<E extends keyof eventName>(event: E, listener: eventName[E]): this
  removeAllListeners<E extends keyof eventName>(event?: E): this
  removeListener<E extends keyof eventName>(event: E, listener: eventName[E]): this

  emit<E extends keyof eventName>(event: E, ...args: Parameters<eventName[E]>): boolean
  eventNames(): (keyof eventName | string | symbol)[]
  rawListeners<E extends keyof eventName>(event: E): eventName[E][]
  listeners<E extends keyof eventName>(event: E): eventName[E][]
  listenerCount<E extends keyof eventName>(event: E): number

  getMaxListeners(): number
  setMaxListeners(maxListeners: number): this
}
