export type OnMutatedHandler = (mutation: { type: string; payload: any }, defaultHandler: (this: any, payload: any) => void) => void

type Mutations<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K] extends ((payload: infer P) => void) ? P : never
}
/**
 * Generic representation of a mutable state
 */
export type MutableState<T> = T & {
  /**
   * The id of the state
   */
  readonly id: string

  subscribe<K extends keyof Mutations<T>>(key: K, listener: (payload: Mutations<T>[K]) => void): MutableState<T>
  subscribe(key: 'state-validating', listener: (v: boolean) => void): MutableState<T>

  unsubscribe<K extends keyof Mutations<T>>(key: K, listener: (payload: Mutations<T>[K]) => void): MutableState<T>
  unsubscribe(key: 'state-validating', listener: (v: boolean) => void): MutableState<T>

  subscribeAll<K extends keyof Mutations<T>>(listener: (mutation: K, payload: Mutations<T>[keyof Mutations<T>]) => void): MutableState<T>

  unsubscribeAll<K extends keyof Mutations<T>>(listener: (mutation: K, payload: Mutations<T>[keyof Mutations<T>]) => void): MutableState<T>

  revalidate(): void
}
