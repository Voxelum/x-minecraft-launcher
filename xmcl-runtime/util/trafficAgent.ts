import throttle from 'lodash.throttle'
import debounce from 'lodash.debounce'

/**
 * Create a simple throttle function for the specific key, which is used to generate lock/semaphore key for the service call.
 */
export function createDynamicThrottle<T extends (...args: any[]) => any>(f: T, keyExtractor: (...param: Parameters<T>) => string, time: number): T {
  const memos: Record<string, (ReturnType<typeof debounce>)> = {}
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
