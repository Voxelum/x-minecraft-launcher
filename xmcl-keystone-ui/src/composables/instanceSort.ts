import { useLocalStorageCache } from '@/composables/cache'
import { Instance } from '@xmcl/runtime-api'
import { Ref } from 'vue'

export function useSortedInstance(instances: Ref<Instance[]>) {
  const ordered = useLocalStorageCache<string[]>('instancesOrder', () => [] as string[], JSON.stringify, JSON.parse)
  const unordered = instances
  const sorted = computed(() => unordered.value.slice().reverse().sort((a, b) => ordered.value.indexOf(a.path) - ordered.value.indexOf(b.path)))

  const moveInstanceTo = (instancePath: string, pivot: string, previous?: boolean) => {
    const targetIndex = sorted.value.findIndex(v => v.path === pivot)
    const newOrders = [] as string[]
    for (let i = 0; i < sorted.value.length; i++) {
      const current = sorted.value[i]
      if (previous) {
        if (i === targetIndex) {
          newOrders.push(instancePath)
        }
      }
      if (current.path !== instancePath) {
        newOrders.push(current.path)
      }
      if (!previous) {
        if (i === targetIndex) {
          newOrders.push(instancePath)
        }
      }
    }
    ordered.value = newOrders
  }

  return {
    instances: sorted,
    moveInstanceTo,
  }
}
