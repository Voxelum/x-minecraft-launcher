export function requireObject(object: unknown, message?: string): asserts object is object {
  if (typeof object !== 'object') throw new TypeError(message || 'Require a object!')
}
export function requireString(object: unknown, message?: any): asserts object is string {
  if (typeof object !== 'string') throw new TypeError(message || `Require a string! But get ${typeof object} ${JSON.stringify(object)}`)
}

export function compareDate(a: Date, b: Date) {
  // @ts-ignore
  return a - b
}

export function toRecord<T, K extends string | symbol | number>(array: T[], key: (v: T) => K) {
  const result: Record<K, T> = {} as any
  for (const i of array) {
    result[key(i)] = i
  }
  return result
}

export function flat<T>(arr: T[][]): T[] {
  return arr.reduce((a, b) => [...a, ...b])
}

export { isNonnull } from '@xmcl/utils'
