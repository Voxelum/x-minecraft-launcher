import { ProjectVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useResourceUrisDiscovery } from './resources'
import { useServiceBusy } from './semaphore'
import { useService } from './service'

export const kModrinthVersions: InjectionKey<ReturnType<typeof useModrinthVersions>> = Symbol('kModrinthVersions')

export function useModrinthVersions(project: Ref<string>, featured?: boolean) {
  const versions: Ref<ProjectVersion[]> = ref([])
  const { getProjectVersions } = useService(ModrinthServiceKey)
  const refreshing = useServiceBusy(ModrinthServiceKey, 'getProjectVersions', project.value)
  const { refresh, error } = useRefreshable(async () => {
    const result = await getProjectVersions({ projectId: project.value, featured })
    versions.value = result
  })
  onMounted(() => {
    refresh()
  })
  return {
    refreshing,
    refresh,
    error,
    versions,
  }
}

export const kModrinthVersionsStatus: InjectionKey<ReturnType<typeof useModrinthVersionsStatus>> = Symbol('ModrinthVersionsStatus')

export function useModrinthVersionsStatus(versions: Ref<ProjectVersion[]>) {
  const { resources } = useResourceUrisDiscovery(computed(() => versions.value.map(v => v.files[0].url)))
  const isDownloaded = (version: ProjectVersion) => !!resources.value[version.files[0].url]
  const getResource = (version: ProjectVersion) => resources.value[version.files[0].url]
  return {
    resources,
    getResource,
    isDownloaded,
  }
}
