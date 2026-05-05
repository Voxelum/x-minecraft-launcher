export function assert<T>(v: T | null): asserts v is T {
  if (!v) {
    throw new Error('nullptr')
  }
}

export function notnull<T>(v: T | null): T {
  if (!v) {
    throw new Error('nullptr')
  }
  return v
}
