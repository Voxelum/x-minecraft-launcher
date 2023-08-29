import { File, FileIndex } from '@xmcl/curseforge'
import { getCurseforgeFileUri, Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useResourceEffect, useResourceUrisDiscovery } from './resources'
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
  useResourceEffect(refresh, ResourceDomain.Modpacks)
  watch([modId, fileIndex], refresh)
  return {
    refresh,
    refreshing,
    resource,
    fileIndex,
  }
}

export function useCurseforgeFileResources(v: Ref<File[]>) {
  const { resources } = useResourceUrisDiscovery(computed(() => v.value.map(v => getCurseforgeFileUri(v))))
  const isDownloaded = (v: File) => !!resources.value[getCurseforgeFileUri(v)]
  const getResource = (v: File) => resources.value[getCurseforgeFileUri(v)]
  return {
    resources,
    getResource,
    isDownloaded,
  }
}

export const kLatestCurseforgeResource: InjectionKey<ReturnType<typeof useLatestCurseforgeResource>> = Symbol('InstanceCurseforgeResource')
