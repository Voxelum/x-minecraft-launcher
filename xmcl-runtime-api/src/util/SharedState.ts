export type OnMutatedHandler = (mutation: { type: string; payload: any }, defaultHandler: (this: any, payload: any) => void) => void

type Mutations<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K] extends ((payload: infer P) => void) ? P : never
}
/**
 * The shared state can be transferred between main process and renderer process
 */
export type SharedState<T> = T & {
  /**
   * The id of the state
   */
  readonly id: string

  subscribe<K extends keyof Mutations<T>>(key: K, listener: (payload: Mutations<T>[K]) => void): SharedState<T>
  subscribe(key: 'state-validating', listener: (v: boolean) => void): SharedState<T>

  unsubscribe<K extends keyof Mutations<T>>(key: K, listener: (payload: Mutations<T>[K]) => void): SharedState<T>
  unsubscribe(key: 'state-validating', listener: (v: boolean) => void): SharedState<T>

  subscribeAll<K extends keyof Mutations<T>>(listener: (mutation: K, payload: Mutations<T>[keyof Mutations<T>]) => void): SharedState<T>

  unsubscribeAll<K extends keyof Mutations<T>>(listener: (mutation: K, payload: Mutations<T>[keyof Mutations<T>]) => void): SharedState<T>

  revalidate(): void
}
