import { ProjectVersion } from '@xmcl/modrinth'
import { Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { useService } from './service'
import { client } from '@/util/modrinthClients'

export function useModrinthLatestVersion(sha1: Ref<string>, projectId: Ref<string>) {
  const latestVersion = ref(undefined as undefined | ProjectVersion)
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const latestVersionResource = ref(undefined as undefined | Resource)
  const { isValidating: refreshing, error, mutate: refresh } = useSWRV(
    computed(() => `/modrinth/version_file/${sha1.value}`), async () => {
      const hash = sha1.value
      if (!hash) return
      latestVersion.value = await client.getLatestProjectVersion(hash)
      const [resource] = await getResourcesByUris([latestVersion.value.files[0].url])
      latestVersionResource.value = resource
    })

  return {
    latestVersion,
    latestVersionResource,
    refresh,
    error,
    refreshing,
  }
}
