import { computed } from '@vue/composition-api'
import { LaunchServiceKey } from '@xmcl/runtime-api'
import { useService } from '/@/composables'

export function useLaunch() {
  const { state, launch } = useService(LaunchServiceKey)
  const status = computed(() => state.status)
  const launchCount = computed(() => state.activeCount)
  const errorType = computed(() => state.errorType)
  const errors = computed(() => state.errors.map((e) => {
    if (e instanceof Error) {
      return e.stack
    }
    return JSON.stringify(e)
  }).join('\n'))
  return {
    launchCount,
    status,
    errorType,
    errors,
    launch,
  }
}
