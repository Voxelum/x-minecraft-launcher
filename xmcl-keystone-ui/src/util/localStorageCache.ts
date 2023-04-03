
import { SWRVCache } from 'swrv'
import { ICacheItem } from 'swrv/dist/cache'
import { IKey } from 'swrv/dist/types'

// @ts-ignore
export class LocalStroageCache extends SWRVCache<any> {
  constructor(private prefix: string, protected ttl = 0) {
    super()
  }

  get(k: string): ICacheItem<any> {
    const _key = this.serializeKey(k)
    const cached = localStorage.getItem(this.prefix + _key)
    if (cached) {
      const entry = JSON.parse(cached)
      return entry
    }
    return undefined as any
  }

  set(k: string, v: any, ttl: number): void {
    const _key = this.serializeKey(k)
    const timeToLive = ttl || this.ttl
    const now = Date.now()
    const item = {
      data: v,
      createdAt: now,
      expiresAt: timeToLive ? now + timeToLive : Infinity,
    }
    this.dispatchExpire(timeToLive, item, _key)
    localStorage.setItem(this.prefix + _key, JSON.stringify(item))
  }

  dispatchExpire(ttl: any, item: any, serializedKey: any): void {
    if (ttl) {
      setTimeout(() => {
        const current = Date.now()
        const hasExpired = current >= item.expiresAt
        if (hasExpired) { this.delete(serializedKey) }
      }, ttl)
    }
  }

  delete(serializedKey: string): void {
    localStorage.removeItem(this.prefix + serializedKey)
  }
}
