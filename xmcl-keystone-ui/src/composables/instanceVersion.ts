import { Instance, VersionServiceKey, getResolvedVersion } from '@xmcl/runtime-api'
import { useService } from './service'
import { Ref } from 'vue'
import useSWRV from 'swrv'

export function useLocalVersionHeader(instance: Ref<Instance>) {
  const { state, resolveLocalVersion } = useService(VersionServiceKey)
  const versionHeader = computed(() => {
    return getResolvedVersion(state.local, instance.value.runtime, instance.value.version)
  })

  const { isValidating, mutate, data: resolvedVersion } = useSWRV(`/instance/${instance.value.path}/version`, async () => {
    if (!versionHeader.value) {
      return undefined
    }
    return await resolveLocalVersion(versionHeader.value.id)
  })

  watch([versionHeader], () => {
    mutate()
  })
  return undefined
}