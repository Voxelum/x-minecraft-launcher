const CACHE: Map<string, any> = new Map();

/**
 * im-memory cache
 */
export function useCache<T>(key: string, defaultValue: T): T {
    if (CACHE.has(key)) {
        return CACHE.get(key)!;
    }
    CACHE.set(key, defaultValue);
    return defaultValue;
}

export function clearAllCache() {
    CACHE.clear();
}

export function clearCache(key: string) {
    CACHE.delete(key);
}
