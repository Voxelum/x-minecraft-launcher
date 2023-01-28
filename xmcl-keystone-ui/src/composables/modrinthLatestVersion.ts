import { ProjectVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export function useModrinthLatestVersion(sha1: Ref<string>, projectId: Ref<string>) {
  const latestVersion = ref(undefined as undefined | ProjectVersion)
  const { getLatestProjectVersion } = useService(ModrinthServiceKey)
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const latestVersionResource = ref(undefined as undefined | Resource)
  const { refresh, error, refreshing } = useRefreshable(async () => {
    const hash = sha1.value
    if (!hash) return
    latestVersion.value = await getLatestProjectVersion(hash)
    const [resource] = await getResourcesByUris([latestVersion.value.files[0].url])
    latestVersionResource.value = resource
  })
  onMounted(refresh)
  watch([sha1, projectId], refresh)

  return {
    latestVersion,
    latestVersionResource,
    refresh,
    error,
    refreshing,
  }
}
