import { computed, InjectionKey, reactive, set } from '@vue/composition-api'
import { injection } from '../util/inject'
import { useRefreshable } from './refreshable'

export function useBusy(semaphore: string | Function) {
  const sem = useSemaphore(semaphore)
  return computed(() => sem.value > 0)
}

export const SERVICES_SEMAPHORES_KEY: InjectionKey<ReturnType<typeof useSemaphores>> = Symbol('SERVICES_SHEMAPHORES_KEY')

export function useSemaphore(semaphore: string | Function) {
  const { semaphores } = injection(SERVICES_SEMAPHORES_KEY)
  const key = typeof semaphore === 'function' ? semaphore.name : semaphore
  return computed(() => {
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
  return { semaphores: container, refresh, refreshing }
}
