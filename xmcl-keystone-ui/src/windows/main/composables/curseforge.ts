import { computed, onMounted, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api'
import { AddonInfo, Attachment, File } from '@xmcl/curseforge'
import { CurseForgeServiceKey, InstanceModsServiceKey, PersistedResource, ProjectType, ResourceServiceKey } from '@xmcl/runtime-api'
import { useBusy, useRouter, useService } from '/@/composables'

/**
 * Hook to view the curseforge project downloadable files.
 * @param projectId The project id
 */
export function useCurseforgeProjectFiles(projectId: number) {
  const { state, fetchProjectFiles } = useService(CurseForgeServiceKey)
  const { state: resourceState } = useService(ResourceServiceKey)
  const data = reactive({
    files: [] as readonly File[],
    loading: false,
  })
  const status = computed(() => data.files.map(file => {
    const find = (m: PersistedResource) => {
      if ('curseforge' in m && typeof m.curseforge === 'object') {
        const s = m.curseforge
        if (s.fileId === file.id) return true
      }
      return false
    }
    if (resourceState.mods.find(find)) return true
    if (resourceState.resourcepacks.find(find)) return true
    if (resourceState.modpacks.find(find)) return true
    if (resourceState.saves.find(find)) return true

    return false
  }))
  async function refresh() {
    data.loading = true
    try {
      const f = await fetchProjectFiles(projectId)
      data.files = Object.freeze(f)
    } finally {
      data.loading = false
    }
  }
  onMounted(() => {
    refresh()
  })
  return {
    ...toRefs(data),
    status,
    refresh,
  }
}

export function useCurseforgeInstall(type: ProjectType, projectId: number) {
  const { state, installFile } = useService(CurseForgeServiceKey)
  const { state: resourceState } = useService(ResourceServiceKey)
  const { install: installMod } = useService(InstanceModsServiceKey)
  function getFileStatus(file: File): 'downloading' | 'downloaded' | 'remote' {
    const res = resourceState.queryResource(file.downloadUrl)
    if (res) {
      return 'downloaded'
    }
    const downloading = state.downloading.find((f) => f.fileId === file.id)
    return downloading ? 'downloading' : 'remote'
  }
  function getFileResource(file: File) {
    return resourceState.queryResource(file.downloadUrl)
  }
  async function install(file: File, toInstance?: string) {
    const resource = await installFile({ file, type, projectId })
    if (toInstance) {
      if (resource.domain === 'mods') {
        console.log(`Install mod ${file.fileName} to ${toInstance}`)
        await installMod({ mods: [resource], path: toInstance })
      }
    }
    return resource
  }

  return { getFileStatus, install, getFileResource }
}

export function useCurseforgeProjectDescription(projectId: number) {
  const { fetchProjectDescription } = useService(CurseForgeServiceKey)
  const data = reactive({
    description: '',
    loading: false,
  })
  async function refresh() {
    data.loading = true
    try {
      const des = await fetchProjectDescription(projectId)
      data.description = des
    } finally {
      data.loading = false
    }
  }
  onMounted(() => {
    refresh()
  })
  return { ...toRefs(data), refresh }
}
/**
 * Hook to view the front page of the curseforge project.
 * @param id The project id
 */
export function useCurseforgeProject(projectId: number) {
  const { fetchProject } = useService(CurseForgeServiceKey)
  const recentFiles: Ref<File[]> = ref([])
  const data = reactive({
    name: '',
    createdDate: '',
    lastUpdate: '',
    totalDownload: 0,
    attachments: [] as Attachment[],
    refreshingProject: false,
  })
  async function refresh() {
    data.refreshingProject = true
    try {
      const proj = await fetchProject(projectId)
      const { name, dateCreated, dateModified, downloadCount, latestFiles } = proj
      data.name = name
      data.createdDate = dateCreated
      data.lastUpdate = dateModified
      data.totalDownload = downloadCount
      data.attachments = proj.attachments
      // @ts-ignore
      recentFiles.value = latestFiles.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate))
    } finally {
      data.refreshingProject = false
    }
  }
  onMounted(() => refresh())
  return {
    ...toRefs(data),
    recentFiles,
    refresh,
  }
}

export function useCurseforgeCategories() {
  const { state, loadCategories } = useService(CurseForgeServiceKey)
  const categories = computed(() => state.categories)
  const refreshing = useBusy('loadCategories()')
  onMounted(() => {
    loadCategories()
  })
  return { categories, refreshing }
}
