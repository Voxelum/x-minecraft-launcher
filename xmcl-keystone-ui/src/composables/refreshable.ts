import { ref } from 'vue'

export function useRefreshable<T>(func: () => Promise<void>) {
  const refreshing = ref(false)
  const refresh = () => {
    refreshing.value = true
    return func().finally(() => { refreshing.value = false })
  }
  return { refreshing, refresh }
}
