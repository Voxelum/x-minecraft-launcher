import { Settings, SharedState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'

export const kCriticalStatus: InjectionKey<ReturnType<typeof useCriticalStatus>> = Symbol('CriticalStatus')

export function useCriticalStatus(settings: Ref<SharedState<Settings> | undefined>) {
  const isOpened = computed(() => settings.value?.databaseReady ?? false)
  const isNoEmptySpace = computed(() => settings.value?.diskFullError ?? false)
  const invalidGameDataPath = computed(() => settings.value?.invalidGameDataPath ?? false)
  return {
    isOpened,
    isNoEmptySpace,
    invalidGameDataPath,
  }
}
