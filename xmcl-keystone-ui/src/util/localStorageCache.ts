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
            if (entry.expiresAt < now || entry.createdAt + this.ttl < now) {
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
    localStorage.getItem(this.prefix + k)
    const _key = this.serializeKey(k)
    const cached = localStorage.getItem(this.prefix + _key)
    if (cached) {
      const entry = JSON.parse(cached)
      return entry
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
