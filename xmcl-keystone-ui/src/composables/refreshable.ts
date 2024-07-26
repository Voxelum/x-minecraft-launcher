import { ref } from 'vue'

export function useRefreshable<T = void>(func: (p: T) => Promise<void>) {
  const refreshing = ref(false)
  const error = ref(null as unknown)
  const refresh = (p: T) => {
    refreshing.value = true
    error.value = undefined
    return func(p).catch((e) => {
      error.value = e
    }).finally(() => { refreshing.value = false })
  }
  return { refreshing, refresh, error }
}
