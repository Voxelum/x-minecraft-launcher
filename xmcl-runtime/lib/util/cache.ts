import { readFile, writeFile } from 'atomically'
import filenamify from 'filenamify'
import { ensureDir, unlink } from 'fs-extra'
import { join } from 'path'
import { ClassicLevel } from 'classic-level'
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

export class PersistedInMemoryCache<T> extends CacheDictionary<T> {
  constructor(private cacheFile: string) {
    super(60 * 1000 * 10)
    readFile(this.cacheFile, { encoding: 'utf-8' }).then((v) => {
      this.cache = JSON.parse(v)
    }, () => {
      // ignore error
    })
  }

  set(key: string, value: T, ttl?: number) {
    super.set(key, value, ttl)
    writeFile(this.cacheFile, JSON.stringify(this.cache))
  }

  delete(key: string) {
    super.delete(key)
    writeFile(this.cacheFile, JSON.stringify(this.cache))
    return true
  }

  clear(): void {
    super.clear()
    writeFile(this.cacheFile, JSON.stringify(this.cache))
  }
}

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
