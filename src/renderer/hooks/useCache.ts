import { Ref, ref, onUnmounted, watch } from "@vue/composition-api";

const CACHE: Map<string, any> = new Map();

/**
 * im-memory cache
 */
export function useInMemoryCache<T>(key: string, defaultValue: T): T {
    if (CACHE.has(key)) {
        return CACHE.get(key)!;
    }
    CACHE.set(key, defaultValue);
    return defaultValue;
}

export function clearInMemoryCacheAll() {
    CACHE.clear();
}

export function clearInMemoryCache(key: string) {
    CACHE.delete(key);
}

export function useLocalStorageCache(key: string, defaultValue: string): Ref<string> {
    let result = localStorage.getItem(key);
    let v = ref(defaultValue ?? result);
    if (!result) {
        localStorage.setItem(key, defaultValue);
    }
    watch(v, (n) => {
        localStorage.setItem(key, n);
    });
    return v;
}

export function useLocalStorageCacheBool(key: string, defaultValue: boolean): Ref<boolean> {
    let result = localStorage.getItem(key);
    let v = ref(result ? result === 'true' : defaultValue);
    if (!result) {
        localStorage.setItem(key, defaultValue.toString());
    }
    watch(v, (n) => {
        localStorage.setItem(key, n.toString());
    });
    return v;
}
