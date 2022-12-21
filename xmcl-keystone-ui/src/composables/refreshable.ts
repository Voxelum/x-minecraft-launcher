import { ref } from 'vue'

export function useRefreshable<T>(func: () => Promise<void>) {
  const refreshing = ref(false)
  const error = ref(null as unknown)
  const refresh = () => {
    refreshing.value = true
    error.value = undefined
    return func().catch((e) => {
      error.value = e
    }).finally(() => { refreshing.value = false })
  }
  return { refreshing, refresh, error }
}
