import { BaseServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey } from 'vue'
import { useService } from './service'

export const kDatabaseStatus: InjectionKey<ReturnType<typeof useDatabaseStatus>> = Symbol('DatabaseStatus')

export function useDatabaseStatus() {
  const { isResourceDatabaseOpened } = useService(BaseServiceKey)
  const { data } = useSWRV('isResourceDatabaseOpened', isResourceDatabaseOpened)
  const isOpened = computed(() => data.value ?? false)
  return {
    isOpened,
  }
}
