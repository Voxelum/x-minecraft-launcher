import { SWRVCache } from 'swrv'
import { ICacheItem } from 'swrv/dist/cache'

interface CacheEntry {
  data: any
  createdAt: number
  expiresAt: number | null
}

export class LocalStroageCache extends SWRVCache<any> {
  #callbackId: number | undefined
  #lastTTLCheck: number | undefined

  constructor(private prefix: string, protected ttl = 24 * 60 * 60 * 1000 * 7 /* 7days */) {
    super()
  }

  checkTTL() {
    if (this.#callbackId) { return }
    if (this.#lastTTLCheck && Date.now() - this.#lastTTLCheck < (1000 * 60 * 5) /* 5mins */) { return }
    // iterate all items in localStorage and find the cache entry and check if the entry is expired
    this.#callbackId = requestIdleCallback(() => {
      const now = Date.now()
      const length = localStorage.length
      const expired = [] as string[]
      for (let i = 0; i < length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.prefix)) {
          const cached = localStorage.getItem(key)
          if (cached) {
            const entry = JSON.parse(cached)
            if ((entry.expiresAt !== null && entry.expiresAt <= now) || entry.createdAt + this.ttl <= now) {
              expired.push(key)
            }
          }
        }
      }
      for (const key of expired) {
        localStorage.removeItem(key)
      }
      console.debug(`[LocalStorageCache] Cleaned ${expired.length} expired cache.`)
      this.#callbackId = undefined
      this.#lastTTLCheck = now
    })
  }

  get(k: string): ICacheItem<any> {
    this.checkTTL()
    const _key = this.serializeKey(k)
    const storageKey = this.prefix + _key
    const cached = localStorage.getItem(storageKey)
    if (cached) {
      const entry: CacheEntry = JSON.parse(cached)
      // Idle cleanup may be delayed or throttled. Never serve an expired entry
      // while waiting for it, including entries restored from a previous run.
      const now = Date.now()
      if ((entry.expiresAt !== null && entry.expiresAt <= now) || entry.createdAt + this.ttl <= now) {
        localStorage.removeItem(storageKey)
        return undefined as any
      }
      return entry as ICacheItem<any>
    }
    return undefined as any
  }

  set(k: string, v: any, ttl: number): void {
    this.checkTTL()
    const _key = this.serializeKey(k)
    const timeToLive = ttl || this.ttl
    const now = Date.now()
    const item = {
      data: v,
      createdAt: now,
      expiresAt: timeToLive ? now + timeToLive : Infinity,
    }
    localStorage.setItem(this.prefix + _key, JSON.stringify(item))
  }

  delete(serializedKey: string): void {
    this.checkTTL()
    localStorage.removeItem(this.prefix + serializedKey)
  }
}
