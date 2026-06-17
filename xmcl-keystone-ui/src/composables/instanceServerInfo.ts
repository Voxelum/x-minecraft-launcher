import { useService } from '@/composables'
import { InstanceServerInfoServiceKey, ServerInfoState, ServerInfoWithStatus } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useState } from './syncableState'

export const kInstanceServerInfo: InjectionKey<ReturnType<typeof useInstanceServerInfo>> = Symbol('InstanceServerInfo')

/**
 * Watch the `servers.dat` of the given instance and expose mutation helpers
 * (add / update / remove) that round-trip through `InstanceServerInfoService`.
 */
export function useInstanceServerInfo(instancePath: Ref<string>) {
  const { watch, addServer, updateServer, removeServer } = useService(InstanceServerInfoServiceKey)
  const { state, isValidating, error, revalidate } = useState(
    () => instancePath.value ? watch(instancePath.value) : undefined,
    ServerInfoState,
  )

  const servers = computed<ServerInfoWithStatus[]>(() => state.value?.serverInfos ?? [])

  return {
    servers,
    isValidating,
    error,
    revalidate,
    addServer,
    updateServer,
    removeServer,
  }
}
