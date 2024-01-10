import { ResourceServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'
import useSWRV from 'swrv'
import { InjectionKey } from 'vue'

export const kDatabaseStatus: InjectionKey<ReturnType<typeof useDatabaseStatus>> = Symbol('DatabaseStatus')

export function useDatabaseStatus() {
  const { isResourceDatabaseOpened } = useService(ResourceServiceKey)
  const { data } = useSWRV('isResourceDatabaseOpened', isResourceDatabaseOpened)
  const isOpened = computed(() => data.value ?? false)
  return {
    isOpened,
  }
}
