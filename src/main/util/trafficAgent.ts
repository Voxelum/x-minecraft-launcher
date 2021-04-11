import throttle from 'lodash.throttle'
import { DebouncedFunc } from 'lodash'

export function createhDynamicThrottle<T extends (...args: any[]) => any>(f: T, keyExtractor: (...param: Parameters<T>) => string, time: number): T {
  const memos: Record<string, DebouncedFunc<T>> = {}
  const result: T = (((...params: any[]) => {
    const key = keyExtractor(...params as any)
    if (memos[key]) {
      return memos[key](...params as any) as any
    }
    const func = throttle(f, time)
    memos[key] = func
    return (func as any)() as any
  }) as any as T)
  return result
}
