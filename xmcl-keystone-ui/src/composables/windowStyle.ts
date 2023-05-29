import { injection } from '@/util/inject'
import { useEnvironment } from './environment'
import { kSettingsState } from './setting'

export function useWindowStyle() {
  const { state } = injection(kSettingsState)
  const env = useEnvironment()
  const maximized = ref(false)
  windowController.on('maximize', (v) => {
    maximized.value = v
  })
  windowController.on('minimize', (v) => {
    maximized.value = v
  })
  const hideWindowControl = computed(() => env.value?.os === 'osx' || (env.value?.os === 'linux' && state.value?.linuxTitlebar))
  const shouldShiftBackControl = computed(() => env.value?.os === 'osx')
  return {
    shouldShiftBackControl,
    hideWindowControl,
  }
}
