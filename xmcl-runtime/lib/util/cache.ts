/**
 * The helper class to hold object with ttl, which is useful for holding web api result.
 */
export class CacheDictionary<T> {
  protected cache: Record<string, [T, number, number?] | undefined> = {}

  constructor(readonly ttl: number) { }

  get(key: string | number): T | undefined {
    const entry = this.cache[key]
    if (!entry) {
      return undefined
    }
    const [cache, createAt, ttl] = entry
    if (!ttl) {
      return cache
    }
    if (Date.now() - createAt > ttl) {
      this.delete(key as any)
      return undefined
    }
    return cache
  }

  set(key: string, value: T, ttl?: number) {
    this.cache[key] = [value, Date.now(), ttl]
  }

  delete(key: string) {
    delete this.cache[key]
    return true
  }

  clear() {
    this.cache = {}
  }
}
