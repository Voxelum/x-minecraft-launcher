import { FileIndex } from '@xmcl/curseforge'
import { getCurseforgeFileUri, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export function useLatestCurseforgeResource(modId: Ref<number>, fileIndex: Ref<FileIndex | undefined>) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const resource: Ref<Resource| undefined> = ref()
  const { refresh, refreshing } = useRefreshable(async () => {
    if (fileIndex.value) {
      const [res] = await getResourcesByUris([getCurseforgeFileUri({ modId: modId.value, id: fileIndex.value.fileId })])
      resource.value = res
    }
  })
  onMounted(refresh)
  watch([modId, fileIndex], refresh)
  return {
    refresh,
    refreshing,
    resource,
    fileIndex,
  }
}

export const kLatestCurseforgeResource: InjectionKey<ReturnType<typeof useLatestCurseforgeResource>> = Symbol('InstanceCurseforgeResource')
