import { computed } from 'vue'
import { LaunchServiceKey } from '@xmcl/runtime-api'
import { DialogKey } from './dialog'
import { useService } from '@/composables'

export const LaunchStatusDialogKey: DialogKey<void> = 'launch-status'

export function useLaunch() {
  const { state, launch } = useService(LaunchServiceKey)
  const status = computed(() => state.status)
  const launchCount = computed(() => state.activeCount)
  return {
    launchCount,
    status,
    launch,
  }
}
