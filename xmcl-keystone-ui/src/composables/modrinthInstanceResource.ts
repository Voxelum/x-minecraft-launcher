import { Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export const kModrinthInstanceResource: InjectionKey<ReturnType<typeof useModrinthInstanceResource>> = Symbol('ModrinthInstanceResource')

export function useModrinthInstanceResource(projectId: Ref<string>, sha1: Ref<string>) {
  const { getResourceByHash } = useService(ResourceServiceKey)
  const resource: Ref<Resource | undefined> = ref()
  const { refresh, refreshing } = useRefreshable(async () => {
    if (sha1.value) {
      const res = await getResourceByHash(sha1.value)
      resource.value = res
    }
  })
  onMounted(refresh)
  watch([projectId, sha1], refresh)
  return {
    refresh,
    refreshing,
    resource,
  }
}
