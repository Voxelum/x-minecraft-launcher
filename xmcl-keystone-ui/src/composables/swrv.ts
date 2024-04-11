import { SWRVModel } from '@/util/swrvGet'
import useSWRV, { IConfig } from 'swrv'
import { Ref } from 'vue'

export function useSWRVModel<T>(model: SWRVModel<T>, config?: IConfig) {
  return useSWRV(model.key, model.fetcher, config)
}

export function useLoading<T>(isValidating: Ref<boolean>, effect: Ref<any>, key: Ref<T>) {
  const lastKey = ref(undefined as T | undefined)
  watch(effect, () => { lastKey.value = key.value as any })
  const loading = computed(() => isValidating.value && lastKey.value !== key.value)
  return loading
}
