import { SWRVCache, mutate } from 'swrv'

export function swrvGetCache<T>(key: string, cache: SWRVCache<any>): T | undefined {
  const cacheItem = cache?.get(key)
  const newData = cacheItem?.data
  if (newData && !newData.error) {
    if (newData.data) return newData.data
  }
}

export async function swrvGet<T>(key: string, fetcher: () => Promise<T>,
  cache: SWRVCache<any>,
  dedupingInterval: number,
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
  const result = await mutate(key, fetcher(), cache)
  if (result.error) {
    throw result.error
  }
  return result.data as T
}
