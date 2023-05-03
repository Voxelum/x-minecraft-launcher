import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { ProjectVersion } from '@xmcl/modrinth'
import { TaskState } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useResourceUrisDiscovery } from './resources'
import { kTaskManager } from './taskManager'
import { clientModrinthV2 } from '@/util/clients'
import { kSWRVConfig } from './swrvConfig'

export const kModrinthVersions: InjectionKey<ReturnType<typeof useModrinthVersions>> = Symbol('kModrinthVersions')
export const kModrinthVersionsHolder: InjectionKey<Ref<Record<string, ProjectVersion>>> = Symbol('ModrinthVersionsHolder')

export function useModrinthVersions(project: Ref<string>, featured?: boolean, loaders?: Ref<string[] | undefined>, gameVersions?: Ref<string[] | undefined>) {
  const holder = inject(kModrinthVersionsHolder)

  const { mutate, error, isValidating: refreshing, data } = useSWRV(computed(() =>
    `/modrinth/versions/${project.value}?featured=${featured || false}&loaders=${loaders?.value || ''}&gameVersions=${gameVersions?.value || ''}`), async () => {
    const result = (await clientModrinthV2.getProjectVersions(project.value, loaders?.value, gameVersions?.value, featured)).map(markRaw)
    return result
  }, inject(kSWRVConfig))
  watch(data, (result) => {
    if (holder && result) {
      const newHolder = { ...holder.value }
      for (const v of result) {
        newHolder[v.id] = v
      }
      holder.value = newHolder
    }
  })
  return {
    refreshing,
    refresh: () => mutate(),
    error,
    versions: computed(() => data.value || []),
  }
}

export const kModrinthVersionsStatus: InjectionKey<ReturnType<typeof useModrinthVersionsStatus>> = Symbol('ModrinthVersionsStatus')

export function useModrinthVersionsStatus(versions: Ref<ProjectVersion[]>, project: Ref<string>) {
  const { tasks } = injection(kTaskManager)
  const relatedTasks = computed(() => {
    const all = tasks.value.filter(t => t.state === TaskState.Running && t.path === 'installModrinthFile' && t.param.projectId === project.value)
    const dict = {} as Record<string, TaskItem>
    for (const t of all) {
      dict[t.param.versionId] = t
    }
    return dict
  })
  const { resources } = useResourceUrisDiscovery(computed(() => {
    return versions.value.map(v => v.files[0].url)
  }))
  const isDownloaded = (v: ProjectVersion) => !!resources.value[v.files[0].url]
  const getResource = (v: ProjectVersion) => resources.value[v.files[0].url]
  return {
    resources,
    getResource,
    isDownloaded,
    tasks: relatedTasks,
  }
}
