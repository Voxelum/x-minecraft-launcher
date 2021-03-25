import { SERVICES_SEMAPHORE_KEY } from '/@/constant'
import { inject, computed, set } from '@vue/composition-api'

export function useBusy(semaphore: string | Function) {
  const sem = useSemaphore(semaphore)
  return computed(() => sem.value > 0)
}

export function useSemaphore(semaphore: string | Function) {
  const sems = inject(SERVICES_SEMAPHORE_KEY)
  if (!sems) throw new Error()
  const key = typeof semaphore === 'function' ? semaphore.name : semaphore
  return computed(() => {
    let value = sems[key]
    if (typeof value === 'undefined') {
      set(sems, key, 0)
    }
    value = sems[key]
    return value
  })
}
