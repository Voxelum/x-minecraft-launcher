import { computed } from '@vue/composition-api'
import { useStore } from './useStore'
import { useBusy } from './useSemaphore'

export function useIssues () {
  const { getters } = useStore()
  const issues = computed(() => getters.issues)
  const refreshing = useBusy('diagnose')

  return {
    issues,
    refreshing,
  }
}
