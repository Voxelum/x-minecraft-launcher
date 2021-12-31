type Primitive = number | string
export function isPrimitiveArrayEqual(a: Primitive[], b: Primitive[]): boolean {
  if (a instanceof Array && b instanceof Array) {
    if (a.length !== b.length) return false
    return a.every((v, i) => v === b[i])
  }
  return false
}
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
export function toObjectReducer<T extends { [k in K]: string }, K extends string >(key: K) {
  return (o: { [key: string]: T }, v: T) => { o[v[key]] = v; return o }
}

export function compareDate(a: Date, b: Date) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return a - b
}

export function toRecord<T, K extends string | symbol | number >(array: T[], key: (v: T) => K) {
  const result: Record<K, T> = {} as any
  for (const i of array) {
    result[key(i)] = i
  }
  return result
}

// From https://github.com/andnp/SimplyTyped/blob/master/src/types/objects.ts
export type DeepPartial<T > = Partial<{
  [k in keyof T]:
  T[k] extends unknown[] ? Array<DeepPartial<T[k][number]>> :
    T[k] extends Function ? T[k] :
      T[k] extends object ? DeepPartial<T[k]> :
        T[k];
}>
