import { injection } from '@/util/inject'
import { kEnvironment } from './environment'
import { kSettingsState } from './setting'

export function useWindowStyle() {
  const { state } = injection(kSettingsState)
  const env = injection(kEnvironment)
  const hideWindowControl = computed(() => env.value?.os === 'osx' || (env.value?.os === 'linux' && state.value?.linuxTitlebar))
  const shouldShiftBackControl = computed(() => env.value?.os === 'osx')
  return {
    shouldShiftBackControl,
    hideWindowControl,
  }
}
