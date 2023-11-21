export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}
