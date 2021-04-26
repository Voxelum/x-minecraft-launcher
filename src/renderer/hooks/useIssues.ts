import { computed } from '@vue/composition-api'
import { useBusy } from './useSemaphore'
import { useService } from './useService'
import { DiagnoseServiceKey } from '/@shared/services/DiagnoseService'

export function useIssues () {
  const { state } = useService(DiagnoseServiceKey)
  const issues = computed(() => state.issues)
  const refreshing = useBusy('diagnose')

  return {
    issues,
    refreshing,
  }
}
