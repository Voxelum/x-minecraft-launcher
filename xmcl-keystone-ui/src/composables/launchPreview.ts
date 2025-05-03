import { useRefreshable, useService } from '@/composables'
import { injection } from '@/util/inject'
import { LaunchServiceKey } from '@xmcl/runtime-api'
import { kInstanceLaunch } from './instanceLaunch'
import { kInstance } from './instance'
import { kUserContext } from './user'

export function useLaunchPreview() {
  const { generateArguments } = useService(LaunchServiceKey)
  const { generateLaunchOptions } = injection(kInstanceLaunch)
  const data = reactive({
    preview: [] as string[],
  })
  const { path } = injection(kInstance)
  const { userProfile } = injection(kUserContext)
  const wrapIfSpace = (s: string) => (s.indexOf(' ') !== -1 ? `"${s}"` : s)
  const { refresh, refreshing, error } = useRefreshable(async (side: 'client' | 'server') => {
    const options = await generateLaunchOptions(path.value, userProfile.value, '', side, {}, true)
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
