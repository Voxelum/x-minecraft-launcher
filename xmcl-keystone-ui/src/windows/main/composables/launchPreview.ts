import { LaunchServiceKey } from '@xmcl/runtime-api'
import { useService } from '/@/composables'

export function useLaunchPreview() {
  const { generateArguments } = useService(LaunchServiceKey)
  const data = reactive({
    preview: [] as string[],
  })
  const wrapIfSpace = (s: string) => (s.indexOf(' ') !== -1 ? `"${s}"` : s)
  const refresh = () => generateArguments().then((args) => { data.preview = args })
  const command = computed(() => data.preview.map(wrapIfSpace).join(' '))
  return {
    command,
    ...toRefs(data),
    refresh,
  }
}
