import { Ref, ref, watch } from 'vue'

const CACHE: Map<string, any> = new Map()

/**
 * im-memory cache
 */
export function useInMemoryCache<T>(key: Ref<string>, defaultValue: () => T): Ref<T> {
  const val = CACHE.get(key.value) ?? defaultValue()
  const reference = ref(val)
  CACHE.set(key.value, val)
  watch(key, (newVal) => {
    reference.value = CACHE.get(newVal) ?? defaultValue()
  })
  watch(reference, (newVal) => {
    CACHE.set(key.value, newVal)
  })
  return reference
}

export function clearInMemoryCacheAll() {
  CACHE.clear()
}

export function clearInMemoryCache(key: string) {
  CACHE.delete(key)
}

const LOCAL_STORAGE_CACHE: Record<string, Ref<any>> = {}

export function useLocalStorageCache<T>(key: string, defaultValue: () => T, toString: (t: T) => string, fromString: (s: string) => T): Ref<T> {
  if (LOCAL_STORAGE_CACHE[key]) {
    return LOCAL_STORAGE_CACHE[key]
  }
  const result = localStorage.getItem(key)
  const deserialize = (val: string) => {
    try { return fromString(val) } catch { return defaultValue() }
  }
  const v: Ref<T> = ref(result !== null ? deserialize(result) : defaultValue()) as any
  if (!result) {
    localStorage.setItem(key, toString(v.value))
  }
  watch(v, (n) => {
    localStorage.setItem(key, toString(n))
  })
  LOCAL_STORAGE_CACHE[key] = v
  return v
}

export function useLocalStorageCacheFloat(key: string, defaultValue: number): Ref<number> {
  return useLocalStorageCache(key, () => defaultValue, (n) => n.toString(), (s) => Number.parseFloat(s))
}

export function useLocalStorageCacheInt(key: string, defaultValue: number): Ref<number> {
  return useLocalStorageCache(key, () => defaultValue, (n) => n.toString(), (s) => Number.parseInt(s, 10))
}

export function useLocalStorageCacheStringValue<T extends string = string>(key: string, defaultValue: T): Ref<T> {
  return useLocalStorageCache(key, () => defaultValue, (s) => s, (s) => s as T)
}

export function useLocalStorageCacheBool(key: string, defaultValue: boolean): Ref<boolean> {
  return useLocalStorageCache(key, () => defaultValue, (b) => b.toString(), (s) => s === 'true')
}
