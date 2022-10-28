export function assignShallow(state: Record<string, any>, options: Record<string, any>) {
  const primitive = new Set(['string', 'number', 'boolean'])
  for (const key of Object.keys(state)) {
    if (primitive.has(typeof state[key]) &&
      typeof options[key] === typeof state[key]) {
      state[key] = options[key]
    } else if (state[key] instanceof Array &&
      options[key] instanceof Array) {
      state[key] = options[key]
    }
  }
}
export function requireObject(object: unknown, message?: string): asserts object is object {
  if (typeof object !== 'object') throw new Error(message || 'Require a object!')
}
export function requireString(object: unknown, message?: any): asserts object is string {
  if (typeof object !== 'string') throw new Error(message || `Require a string! But get ${typeof object} ${JSON.stringify(object)}`)
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

export function assignIfPresent<T>(a: T, b: Partial<T>, keys: Array<keyof T>) {
  for (const key of keys) {
    if (key in b && b[key]) {
      a[key] = b[key]!
    }
  }
}

export function flat<T>(arr: T[][]): T[] {
  return arr.reduce((a, b) => [...a, ...b])
}

export function isNonnull<T>(object: T | undefined | null): object is T {
  return object !== undefined && object !== null
}
export function requireNonnull(object: unknown, message?: any): asserts object {
  if (typeof object === 'undefined' || object === null) throw new Error(message || 'Require object existed!')
}

export function isArrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  if (a.some((v, i) => v !== b[i])) return false
  return true
}
