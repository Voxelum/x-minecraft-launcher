import { Disposable } from '@xmcl/runtime-api'
import { Ref } from 'vue'

export function useState<T>(key: Ref<string>, fetcher: () => Promise<Disposable<T>>) {
  const isValidating = ref(false)
  const state = ref<T | undefined>()
  let dispose = () => { }
  const error = ref(undefined as any)
  const mutate = () => {
    isValidating.value = true
    dispose()
    fetcher().then((v) => {
      state.value = v
      dispose = v.dispose
    }, (e) => {
      error.value = e
    }).finally(() => {
      isValidating.value = false
    })
  }
  watch(key, mutate)
  onMounted(mutate)
  onUnmounted(dispose)
  return {
    isValidating,
    state,
    error,
  }
}
