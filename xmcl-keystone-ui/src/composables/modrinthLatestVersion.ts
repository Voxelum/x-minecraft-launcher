import { ProjectVersion } from '@xmcl/modrinth'
import { Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { useService } from './service'
import { clientModrinthV2 } from '@/util/clients'
import { kSWRVConfig } from './swrvConfig'

export function useModrinthLatestVersion(sha1: Ref<string>, projectId: Ref<string>) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const latestVersionResource = ref(undefined as undefined | Resource)
  const { isValidating: refreshing, error, mutate: refresh, data: latestVersion } = useSWRV(
    computed(() => `/modrinth/version_file/${sha1.value}`),
    () => clientModrinthV2.getLatestProjectVersion(sha1.value),
    inject(kSWRVConfig))

  watch(latestVersion, async (v) => {
    if (v) {
      const [resource] = await getResourcesByUris([v.files[0].url])
      latestVersionResource.value = resource
    }
  })

  return {
    latestVersion,
    latestVersionResource,
    refresh,
    error,
    refreshing,
  }
}
