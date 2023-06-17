import { BaseServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'

export function useWindowStyle() {
  const { state } = useService(BaseServiceKey)
  const maximized = ref(false)
  windowController.on('maximize', (v) => {
    maximized.value = v
  })
  windowController.on('minimize', (v) => {
    maximized.value = v
  })
  const hideWindowControl = computed(() => state.platform.name === 'osx' || (state.platform.name === 'linux' && state.linuxTitlebar))
  const shouldShiftBackControl = computed(() => state.platform.name === 'osx')
  return {
    shouldShiftBackControl,
    hideWindowControl,
  }
}
