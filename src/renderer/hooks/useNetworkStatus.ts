import { onMounted, onUnmounted, ref } from '@vue/composition-api'

export function useNetworkStatus () {
  const online = ref(navigator.onLine)

  function updateStatus () {
    online.value = navigator.onLine
  }
  onMounted(() => {
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
  })
  onUnmounted(() => {
    window.removeEventListener('online', updateStatus)
    window.removeEventListener('offline', updateStatus)
  })
  return {
    online,
  }
}
