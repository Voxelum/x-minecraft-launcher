import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { ProjectVersion } from '@xmcl/modrinth'
import { Resource, TaskState } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useResourceUriStartsWithDiscovery, useResourceUrisDiscovery } from './resources'
import { kTaskManager } from './taskManager'
import { clientModrinthV2 } from '@/util/clients'
import { kSWRVConfig } from './swrvConfig'
import { getModrinthVersionKey } from '@/util/modrinth'

export const kModrinthVersions: InjectionKey<ReturnType<typeof useModrinthVersions>> = Symbol('kModrinthVersions')
export const kModrinthVersionsHolder: InjectionKey<Ref<Record<string, ProjectVersion>>> = Symbol('ModrinthVersionsHolder')

export function useModrinthVersions(project: Ref<string>, featured?: boolean, loaders?: Ref<string[] | undefined>, gameVersions?: Ref<string[] | undefined>) {
  const holder = inject(kModrinthVersionsHolder, undefined)

  const { mutate, error, isValidating: refreshing, data } = useSWRV(computed(() => getModrinthVersionKey(project.value, featured, loaders?.value, gameVersions?.value)), async () => {
    const result = (await clientModrinthV2.getProjectVersions(project.value, { loaders: loaders?.value, gameVersions: gameVersions?.value, featured })).map(markRaw)
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
  }, { immediate: true })
  return {
    refreshing,
    refresh: () => mutate(),
    error,
    versions: computed(() => data.value || []),
  }
}

export const kModrinthVersionsStatus: InjectionKey<ReturnType<typeof useModrinthVersionsResources> & { tasks: ReturnType<typeof useModrintTasks> }> = Symbol('ModrinthVersionsStatus')

export function useModrinthTask(versionId: Ref<string>) {
  const { tasks } = injection(kTaskManager)
  return computed(() => {
    return tasks.value.find(t => t.state === TaskState.Running && t.path === 'installModrinthFile' && t.param.versionId === versionId.value)
  })
}

export function useModrintTasks(project: Ref<string>) {
  const { tasks } = injection(kTaskManager)
  return computed(() => {
    const all = tasks.value.filter(t => t.state === TaskState.Running && t.path === 'installModrinthFile' && t.param.projectId === project.value)
    const dict = {} as Record<string, TaskItem>
    for (const t of all) {
      dict[t.param.versionId] = t
    }
    return dict
  })
}

export function useModrinthVersionsResources(v: Ref<ProjectVersion[]>) {
  const { resources } = useResourceUrisDiscovery(computed(() => v.value.map(v => v.files[0].url)))
  const isDownloaded = (v: ProjectVersion) => !!resources.value[v.files[0].url]
  const getResource = (v: ProjectVersion) => resources.value[v.files[0].url]
  return {
    resources,
    getResource,
    isDownloaded,
  }
}

export function useModrinthVersionsResourcesByProjectId(projectId: Ref<string>) {
  const { resources } = useResourceUriStartsWithDiscovery(computed(() => `modrinth:${projectId.value}`))
  const isDownloaded = (v: ProjectVersion) => !!resources.value[v.files[0].url]
  const getResource = (v: ProjectVersion) => resources.value[v.files[0].url]
  return {
    resources,
    getResource,
    isDownloaded,
  }
}
