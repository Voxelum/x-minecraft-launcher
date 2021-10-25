import { provide, reactive, set } from '@vue/composition-api'
import { useRefreshable } from './useRefreshable'

export function useSemaphore() {
  const container: Record<string, number> = reactive({})

  const { refresh, refreshing } = useRefreshable(() => semaphoreChannel.subscribe().then((sem) => {
    for (const [key, val] of Object.entries(sem)) {
      set(container, key, val)
    }
  }))

  semaphoreChannel.on('aquire', (res) => {
    const sem = res instanceof Array ? res : [res]
    for (const s of sem) {
      if (s in container) {
        container[s] += 1
      } else {
        set(container, s, 1)
      }
    }
  })
  semaphoreChannel.on('release', (res) => {
    const sem = res instanceof Array ? res : [res]
    for (const s of sem) {
      if (s in container) {
        container[s] = Math.max(0, container[s] - 1)
      } else {
        set(container, s, 0)
      }
    }
  })
  return { semaphore: container, refresh, refreshing }
}
