import { LocalStroageCache } from '@/util/localStorageCache'
import { IConfig } from 'swrv'
import { InjectionKey } from 'vue'

export const kSWRVConfig: InjectionKey<IConfig> = Symbol('swrvConfig')

export function useSWRVConfig(): IConfig {
  return {
    cache: new LocalStroageCache('/cache'),
    shouldRetryOnError: true,
    revalidateOnFocus: false,
    revalidateDebounce: 1500,
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
