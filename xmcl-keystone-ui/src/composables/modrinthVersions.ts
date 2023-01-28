import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { ProjectVersion } from '@xmcl/modrinth'
import { getModrinthVersionFileUri, ModrinthServiceKey, TaskState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useResourceUrisDiscovery } from './resources'
import { useServiceBusy } from './semaphore'
import { useService } from './service'
import { kTaskManager } from './taskManager'

export const kModrinthVersions: InjectionKey<ReturnType<typeof useModrinthVersions>> = Symbol('kModrinthVersions')
export const kModrinthVersionsHolder: InjectionKey<Ref<Record<string, ProjectVersion>>> = Symbol('ModrinthVersionsHolder')

export function useModrinthVersions(project: Ref<string>, featured?: boolean) {
  const versions: Ref<ProjectVersion[]> = ref([])
  const holder = inject(kModrinthVersionsHolder)
  const { getProjectVersions } = useService(ModrinthServiceKey)
  const refreshing = useServiceBusy(ModrinthServiceKey, 'getProjectVersions', project.value)
  const { refresh, error, refreshing: _refreshing } = useRefreshable(async () => {
    const result = (await getProjectVersions({ projectId: project.value, featured })).map(markRaw)
    versions.value = result
    if (holder) {
      const newHolder = { ...holder.value }
      for (const v of result) {
        newHolder[v.id] = v
      }
      holder.value = newHolder
    }
  })
  onMounted(() => refresh())
  watch(project, refresh)
  return {
    refreshing: computed(() => refreshing.value || _refreshing.value),
    refresh,
    error,
    versions,
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
