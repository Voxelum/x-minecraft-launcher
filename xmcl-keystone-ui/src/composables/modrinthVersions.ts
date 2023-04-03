import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { ProjectVersion } from '@xmcl/modrinth'
import { TaskState } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useResourceUrisDiscovery } from './resources'
import { kTaskManager } from './taskManager'
import { client } from '@/util/modrinthClients'

export const kModrinthVersions: InjectionKey<ReturnType<typeof useModrinthVersions>> = Symbol('kModrinthVersions')
export const kModrinthVersionsHolder: InjectionKey<Ref<Record<string, ProjectVersion>>> = Symbol('ModrinthVersionsHolder')

export function useModrinthVersions(project: Ref<string>, featured?: boolean, loaders?: Ref<string[] | undefined>, gameVersions?: Ref<string[] | undefined>) {
  const holder = inject(kModrinthVersionsHolder)

  const { mutate, error, isValidating: refreshing, data } = useSWRV(computed(() =>
    `/modrinth/versions/${project.value}?featured=${featured || false}&loaders=${loaders?.value || ''}&gameVersions=${gameVersions?.value || ''}`), async () => {
    const result = (await client.getProjectVersions(project.value, loaders?.value, gameVersions?.value, featured)).map(markRaw)
    return result
  })
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

export function useModrinthDependencies() {
  const visited = new Set<string>()
  const visit = async (version: ProjectVersion): Promise<ProjectVersion[]> => {
    if (visited.has(version.project_id)) {
      return []
    }
    visited.add(version.project_id)
    // client.getProjectVersionsById(version.dependencies.map(d => d.version_id).filter((v): v is string => !!v))
    const deps = await Promise.all(version.dependencies.map(async (dep) => {
      if (dep.version_id) {
        const depVersion = await client.getProjectVersion(dep.version_id)
        const result = await visit(depVersion)
        return [result, dep.dependency_type]
      } else {
        const versions = await client.getProjectVersions(dep.project_id, version.loaders, version.game_versions, undefined)
        const result = await visit(versions[0])
        return [result, dep.dependency_type]
      }
    }))
    return [version, ...deps.filter((v): v is string => !!v).reduce((a, b) => a.concat(b), [])]
  }
}
