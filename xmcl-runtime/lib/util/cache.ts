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
