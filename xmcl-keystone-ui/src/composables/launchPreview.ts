import { useRefreshable, useService } from '@/composables'
import { injection } from '@/util/inject'
import { LaunchServiceKey } from '@xmcl/runtime-api'
import { kInstanceLaunch } from './instanceLaunch'

export function useLaunchPreview() {
  const { generateArguments } = useService(LaunchServiceKey)
  const { generateLaunchOptions } = injection(kInstanceLaunch)
  const data = reactive({
    preview: [] as string[],
  })
  const wrapIfSpace = (s: string) => (s.indexOf(' ') !== -1 ? `"${s}"` : s)
  const { refresh, refreshing, error } = useRefreshable(async () => {
    const options = await generateLaunchOptions()
    const args = await generateArguments(options)
    data.preview = args
  })
  const command = computed(() => data.preview.map(wrapIfSpace).join(' '))
  return {
    command,
    ...toRefs(data),
    refreshing,
    error,
    refresh,
  }
}
