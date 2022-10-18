import { InstanceServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import { useLocalStorageCache } from '@/composables/cache'

export function useSortedInstance() {
  const ordered = useLocalStorageCache<string[]>('instancesOrder', () => [] as string[], JSON.stringify, JSON.parse)
  const { state } = useService(InstanceServiceKey)
  const unordered = computed(() => state.instances)

  const sorted = computed(() => {
    const result = unordered.value.slice().sort((a, b) => ordered.value.indexOf(a.path) - ordered.value.indexOf(b.path))
    // console.log(result)
    return result
  })

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
