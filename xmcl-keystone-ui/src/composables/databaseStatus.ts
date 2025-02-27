import { BaseServiceKey, Settings, SharedState } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'

export const kDatabaseStatus: InjectionKey<ReturnType<typeof useDatabaseStatus>> = Symbol('DatabaseStatus')

export function useDatabaseStatus(settings: Ref<SharedState<Settings> | undefined>) {
  const { isResourceDatabaseOpened } = useService(BaseServiceKey)
  const { data } = useSWRV('isResourceDatabaseOpened', isResourceDatabaseOpened)
  const isOpened = computed(() => data.value ?? false)
  const isNoEmptySpace = computed(() => settings.value?.diskFullError ?? false)
  return {
    isOpened,
    isNoEmptySpace,
  }
}
