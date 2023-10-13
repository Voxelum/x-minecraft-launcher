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

export function useLocalStorageCache<T>(key: string, defaultValue: () => T, toString: (t: T) => string, fromString: (s: string) => T, deep = false): Ref<T> {
  const deserialize = (val: string) => {
    try { return fromString(val) } catch { return defaultValue() }
  }
  const cache = localStorage.getItem(key)
  const holder: Ref<T> = ref(cache !== null ? deserialize(cache) : defaultValue()) as any
  if (!cache) {
    localStorage.setItem(key, toString(holder.value))
  }
  watch(holder, (n) => {
    localStorage.setItem(key, toString(n))
  }, { deep })

  const onStorage = (e: StorageEvent) => {
    if (e.key === key) {
      const v = deserialize(e.newValue ?? '')
      if (v !== holder.value) {
        holder.value = v
      }
    }
  }

  onMounted(() => {
    window.addEventListener('storage', onStorage)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
  })

  return holder
}

export function useLocalStorageCacheRef<T>(key: Ref<string>, defaultValue: () => T, toString: (t: T) => string, fromString: (s: string) => T, deep = false): Ref<T> {
  const deserialize = (val: string) => {
    try { return fromString(val) } catch { return defaultValue() }
  }
  const cache = localStorage.getItem(key.value)
  const holder: Ref<T> = ref(cache !== null ? deserialize(cache) : defaultValue()) as any
  watch(key, (newKey) => {
    const cache = localStorage.getItem(newKey)
    holder.value = cache !== null ? deserialize(cache) : defaultValue()
  })
  watch(holder, (n) => {
    localStorage.setItem(key.value, toString(n))
  }, { deep })

  const onStorage = (e: StorageEvent) => {
    if (e.key === key.value) {
      const v = deserialize(e.newValue ?? '')
      if (v !== holder.value) {
        holder.value = v
      }
    }
  }

  onMounted(() => {
    window.addEventListener('storage', onStorage)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
  })

  return holder
}

export function useLocalStorageCacheFloat(key: string, defaultValue: number): Ref<number> {
  return useLocalStorageCache(key, () => defaultValue, (n) => n.toString(), (s) => Number.parseFloat(s))
}

export function useLocalStorageCacheInt(key: string, defaultValue: number): Ref<number> {
  return useLocalStorageCache(key, () => defaultValue, (n) => n.toString(), (s) => Number.parseInt(s, 10))
}

export function useLocalStorageCacheStringValue<T extends string = string>(key: string, defaultValue: T, legacyKey?: string): Ref<T> {
  return useLocalStorageCache(key, () => defaultValue, (s) => s, (s) => s as T)
}

export function useLocalStorageCacheBool(key: string, defaultValue: boolean): Ref<boolean> {
  return useLocalStorageCache(key, () => defaultValue, (b) => b.toString(), (s) => s === 'true')
}
