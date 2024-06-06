import { MaybeRef, get } from '@vueuse/core'
import { SWRVCache, mutate } from 'swrv'
import { Ref } from 'vue'

export interface SWRVModel<T> {
  key: MaybeRef<string> | Ref<string | undefined>
  fetcher: (...args: any[]) => Promise<T>
}

export function getSWRV<T>(model: SWRVModel<T>, config: any) {
  const key = get(model.key)
  if (!key) {
    throw new Error('Key is required')
  }
  return swrvGet(key!, model.fetcher, config.cache!, config.dedupingInterval!)
}

export function formatKey(path: string, record: Record<string, MaybeRef<string | number | undefined | string[] | number[]>>) {
  return `${path}?${buildSearchParameters(record)}`
}

export function buildSearchParameters(record: Record<string, MaybeRef<string | number | undefined | string[] | number[]>>) {
  return Object.entries(record).map(([k, v]) => `${k}=${get(v) || ''}`).join('&')
}

export async function swrvGet<T>(key: string, fetcher: (abortSignal?: AbortSignal) => Promise<T>,
  cache: SWRVCache<any>,
  dedupingInterval: number,
  options?: { abortSignal?: AbortSignal; ttl?: number },
): Promise<T> {
  const cacheItem = cache?.get(key)
  const newData = cacheItem?.data
  if (newData) {
    const shouldRevalidate = Boolean(
      ((Date.now() - cacheItem.createdAt) >= dedupingInterval),
    )
    if (!shouldRevalidate) {
      if (newData.error) {
        throw newData.error
      }
      return newData.data
    }
  }
  const result = await mutate(key, fetcher(options?.abortSignal), cache, options?.ttl)
  if (result.error) {
    throw result.error
  }
  return result.data as T
}
