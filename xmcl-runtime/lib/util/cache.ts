import { ClassicLevel } from 'classic-level'

export class LevelCache<T> {
  private cache: ClassicLevel<string, string>

  constructor(cacheDirectory: string) {
    this.cache = new ClassicLevel(cacheDirectory)
  }

  async get(key: string) {
    return await this.cache.get(key).catch(() => undefined)
  }

  async set(key: string, value: any, ttl?: number) {
    await this.cache.put(key, value)
  }

  async delete(key: string): Promise<boolean> {
    return await this.cache.del(key).then(() => true, () => false)
  }

  clear(): void | Promise<void> {
  }
}

export class InMemoryTtlCache<T> {
  private cache: Record<string, [T, number]> = {}

  get(key: string): T | undefined {
    const entry = this.cache[key]
    if (entry) {
      const [v, expiredAt] = entry
      if (expiredAt < Date.now()) {
        delete this.cache[key]
        return undefined
      }
      return v
    }
    return undefined
  }

  put(key: string, v: T, ttl?: number) {
    this.cache[key] = [v, Date.now() + (ttl ?? 120_000)]
  }
}
