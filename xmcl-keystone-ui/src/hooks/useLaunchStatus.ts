import { computed, reactive, toRefs } from '@vue/composition-api'
import { LaunchServiceKey } from '@xmcl/runtime-api'
import { useService } from './useService'

export function useLaunchEvent() {

}

export function useLaunch() {
  const { state, launch } = useService(LaunchServiceKey)
  const status = computed(() => state.status)
  const errorType = computed(() => state.errorType)
  const errors = computed(() => state.errors.map((e) => {
    if (e instanceof Error) {
      return e.stack
    }
    return JSON.stringify(e)
  }).join('\n'))
  return {
    status,
    errorType,
    errors,
    launch,
  }
}

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
