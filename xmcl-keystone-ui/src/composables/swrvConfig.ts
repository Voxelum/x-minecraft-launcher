import { LocalStroageCache } from '@/util/localStorageCache'
import { IConfig } from 'swrv'
import { InjectionKey } from 'vue'

export const kSWRVConfig: InjectionKey<ReturnType<typeof useSWRVConfig>> = Symbol('swrvConfig')

export function useSWRVConfig() {
  return {
    cache: new LocalStroageCache('/cache'),
    shouldRetryOnError: true,
    revalidateOnFocus: false,
    revalidateDebounce: 1500,
    dedupingInterval: 1000 * 60 * 10,
    ttl: 1000 * 60 * 60 * 24,
  }
}

export function useOverrideSWRVConfig(override: IConfig): IConfig {
  const config = inject(kSWRVConfig)
  if (config) {
    return {
      ...config,
      ...override,
    }
  }
  return override
}
