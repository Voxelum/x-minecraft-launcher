import { computed, InjectionKey, reactive, Ref, set } from 'vue'
import { getServiceSemaphoreKey, ServiceKey } from '@xmcl/runtime-api'
import { injection } from '../util/inject'
import { useRefreshable } from './refreshable'

export function useServiceBusy<T>(key: ServiceKey<T>, method: keyof T, params?: string | Ref<string>) {
  const sem = useSemaphore(computed(() => getServiceSemaphoreKey(key, method, params ? typeof params === 'string' ? params : params.value : undefined)))
  return computed(() => sem.value > 0)
}

export function useBusy(key: string | Ref<string>) {
  const sem = useSemaphore(key)
  return computed(() => sem.value > 0)
}

export const kSemaphores: InjectionKey<ReturnType<typeof useSemaphores>> = Symbol('SERVICES_SHEMAPHORES_KEY')

export function useSemaphore(semaphore: string | Ref<string>) {
  const { semaphores } = injection(kSemaphores)
  return computed(() => {
    const key = typeof semaphore === 'string' ? semaphore : semaphore.value
    let value = semaphores[key]
    if (typeof value === 'undefined') {
      set(semaphores, key, 0)
    }
    value = semaphores[key]
    return value
  })
}

export function useSemaphores() {
  const container: Record<string, number> = reactive({})

  const { refresh, refreshing } = useRefreshable(() => resourceMonitor.subscribe().then((sem) => {
    for (const [key, val] of Object.entries(sem)) {
      set(container, key, val)
    }
  }))

  resourceMonitor.on('acquire', (res) => {
    const sem = res instanceof Array ? res : [res]
    for (const s of sem) {
      if (s in container) {
        container[s] += 1
      } else {
        set(container, s, 1)
      }
    }
  })
  resourceMonitor.on('release', (res) => {
    const sem = res instanceof Array ? res : [res]
    for (const s of sem) {
      if (s in container) {
        container[s] = Math.max(0, container[s] - 1)
      } else {
        set(container, s, 0)
      }
    }
  })

  onMounted(() => {
    refresh()
  })

  return { semaphores: container, refresh, refreshing }
}
