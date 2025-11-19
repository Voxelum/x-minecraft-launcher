import { InstanceScreenshotServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'
import { useRefreshable } from './refreshable'
import { Instance } from '@xmcl/instance'

export function useInstanceScreenshots(path: Ref<string>) {
  const { getScreenshots } = useService(InstanceScreenshotServiceKey)
  const { on, removeListener } = useService(LaunchServiceKey)
  const urls = shallowRef([] as string[])
  const { refresh, refreshing } = useRefreshable<any | undefined>(async () => {
    const result = await getScreenshots(path.value)
    if (result.length === 0) {
      urls.value = []
    } else {
      urls.value = result
    }
  })
  watch(path, refresh, { immediate: true })
  on('minecraft-exit', refresh)
  onUnmounted(() => {
    removeListener('minecraft-exit', refresh)
  })
  return {
    urls,
    refreshing,
  }
}
