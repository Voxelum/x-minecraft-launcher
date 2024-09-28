import { MaybeRef } from '@vueuse/core'
import { Ref, ref, watch } from 'vue'

export interface LocalStorageOptions {
  deep?: boolean
  legacyKey?: string
  migrate?: (v: string) => string
}

export function useLocalStorageCache<T>(key: Ref<string> | string, defaultValue: () => T, toString: (t: T) => string, fromString: (s: string) => T, options?: LocalStorageOptions): Ref<T> {
  const deserialize = (val: string) => {
    try { return fromString(val) } catch { return defaultValue() }
  }
  const cache = localStorage.getItem(typeof key === 'string' ? key : key.value)
  const holder: Ref<T> = ref(cache !== null ? deserialize(cache) : defaultValue()) as any
  if (typeof key !== 'string') {
    watch(key, (newKey) => {
      const cache = localStorage.getItem(newKey)
      holder.value = cache !== null ? deserialize(cache) : defaultValue()
    })
  }
  watch(holder, (n) => {
    localStorage.setItem(typeof key === 'string' ? key : key.value, toString(n))
  }, { deep: options?.deep })

  const onStorage = (e: StorageEvent) => {
    if (e.key === (typeof key === 'string' ? key : key.value)) {
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

export function useLocalStorageCacheInt(key: MaybeRef<string>, defaultValue: number): Ref<number> {
  return useLocalStorageCache(key, () => defaultValue, (n) => n.toString(), (s) => Number.parseInt(s, 10))
}

export function useLocalStorageCacheStringValue<T extends string = string>(key: string, defaultValue: T, options?: LocalStorageOptions): Ref<T> {
  return useLocalStorageCache(key, () => defaultValue, (s) => s, (s) => s as T, options)
}

export function useLocalStorageCacheBool(key: Ref<string> | string, defaultValue: boolean): Ref<boolean> {
  return useLocalStorageCache(key, () => defaultValue, (b) => b.toString(), (s) => s === 'true')
}
