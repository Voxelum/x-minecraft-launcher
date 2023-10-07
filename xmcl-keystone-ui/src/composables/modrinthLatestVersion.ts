import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { getModrinthVersionKey } from '@/util/modrinth'
import { swrvGet } from '@/util/swrvGet'
import { ModerinthApiError } from '@xmcl/modrinth'
import { Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { useService } from './service'
import { kSWRVConfig } from './swrvConfig'

export function useModrinthLatestVersion(sha1: Ref<string>, projectId: Ref<string>) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const { cache, dedupingInterval } = injection(kSWRVConfig)
  const latestVersionResource = ref(undefined as undefined | Resource)
  const { isValidating: refreshing, error, mutate: refresh, data: latestVersion } = useSWRV(
    computed(() => `/modrinth/version_file/${sha1.value}`),
    async () => {
      try {
        return await clientModrinthV2.getLatestProjectVersion(sha1.value)
      } catch (e) {
        const err = e as ModerinthApiError
        if (err.status === 404) {
          // Not found
          const versions = await swrvGet(getModrinthVersionKey(projectId.value, undefined, [], []), async () => {
            return clientModrinthV2.getProjectVersions(projectId.value)
          }, cache, dedupingInterval)

          return versions[0]
        }
      }
    },
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
