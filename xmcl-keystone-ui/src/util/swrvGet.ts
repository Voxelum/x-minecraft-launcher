import { SWRVCache, mutate } from 'swrv'
import { Ref } from 'vue'

export interface SWRVModel<T> {
  key: Ref<string | undefined>
  fetcher: (...args: any[]) => Promise<T>
}

export function getSWRV<T>(model: SWRVModel<T>, config: any) {
  if (model.key.value) {
    return swrvGet(model.key.value, model.fetcher, config.cache!, config.dedupingInterval!)
  }
  return Promise.resolve(undefined)
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
