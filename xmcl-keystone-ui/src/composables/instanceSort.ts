import { useLocalStorageCache } from '@/composables/cache'
import { Instance } from '@xmcl/runtime-api'
import { Ref } from 'vue'

export function useSortedInstance(instances: Ref<Instance[]>) {
  const ordered = useLocalStorageCache<string[]>('instancesOrder', () => [] as string[], JSON.stringify, JSON.parse)
  const unordered = instances
  const sorted = computed(() => unordered.value.slice().reverse().sort((a, b) => ordered.value.indexOf(a.path) - ordered.value.indexOf(b.path)))

  const setToPrevious = (instancePath: string, pivot: string) => {
    const targetIndex = sorted.value.findIndex(v => v.path === pivot)
    const result = [] as string[]
    for (let i = 0; i < sorted.value.length; i++) {
      const current = sorted.value[i]
      if (i === targetIndex) {
        result.push(instancePath)
      }
      if (current.path !== instancePath) {
        result.push(current.path)
      }
    }
    ordered.value = result
  }

  return {
    instances: sorted,
    setToPrevious,
  }
}
