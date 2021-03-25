import { computed, onMounted, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api'
import { AddonInfo, Attachment, File } from '@xmcl/curseforge'
import { useRouter } from './useRouter'
import { useBusy } from './useSemaphore'
import { useService } from './useService'
import { useStore } from './useStore'
import { ProjectType } from '/@shared/entities/curseforge'
import { CurseForgeServiceKey } from '/@shared/services/CurseForgeService'
import { InstanceResourceServiceKey } from '/@shared/services/InstanceResourceService'

/**
 * Hook to view the curseforge project downloadable files.
 * @param projectId The project id
 */
export function useCurseforgeProjectFiles(projectId: number) {
  const { fetchProjectFiles } = useService(CurseForgeServiceKey)
  const { getters } = useStore()
  const data = reactive({
    files: [] as readonly File[],
    loading: false,
  })
  const status = computed(() => data.files.map(file => getters.isFileInstalled({ id: file.id, href: file.downloadUrl })))
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
  const { installFile } = useService(CurseForgeServiceKey)
  const { deploy } = useService(InstanceResourceServiceKey)
  const { state, getters } = useStore()
  function getFileStatus(file: File): 'downloading' | 'downloaded' | 'remote' {
    const res = getters.queryResource(file.downloadUrl)
    if (res) {
      return 'downloaded'
    }
    const downloading = state.curseforge.downloading.find((f) => f.fileId === file.id)
    return downloading ? 'downloading' : 'remote'
  }
  function getFileResource(file: File) {
    return getters.queryResource(file.downloadUrl)
  }
  async function install(file: File, toInstance?: string) {
    const resource = await installFile({ file, type, projectId })
    if (toInstance) {
      await deploy({ resources: [resource], path: toInstance })
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
      recentFiles.value = latestFiles
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
  const { loadCategories } = useService(CurseForgeServiceKey)
  const { state } = useStore()
  const categories = computed(() => state.curseforge.categories)
  const refreshing = useBusy('loadCategories')
  onMounted(() => {
    loadCategories()
  })
  return { categories, refreshing }
}

/**
 * Hook to returen the controller of curseforge preview page. Navigating the curseforge projects.
 */
export function useCurseforgeSearch(type: string, page: Ref<number>, keyword: Ref<string | undefined>) {
  let sectionId: number
  switch (type) {
    default:
    case 'mc-mods':
      sectionId = 6
      break
    case 'modpacks':
      sectionId = 4471
      break
    case 'texture-packs':
      sectionId = 12
      break
    case 'worlds':
      sectionId = 17
      break
  }

  const router = useRouter()
  const { searchProjects } = useService(CurseForgeServiceKey)
  const pageSize = 5
  const currentPage = computed({
    get() { return page.value },
    set(v: number) {
      const route = router.currentRoute
      router.push({ query: { ...route.query, page: v.toString() } })
    },
  })
  const data = reactive({
    pages: 5,

    gameVersion: undefined as undefined | string,

    sort: undefined as undefined | number,

    projects: [] as AddonInfo[],

    loading: false,

    currentKeyword: keyword.value,
  })
  const index = computed(() => (currentPage.value - 1) * pageSize)
  const refs = toRefs(data)
  async function refresh() {
    data.loading = true
    try {
      const projects = await searchProjects({
        pageSize,
        index: index.value,
        sectionId,
        sort: data.sort,
        gameVersion: data.gameVersion,
        searchFilter: keyword.value,
      })
      if (currentPage.value > data.pages / 2) {
        data.pages += 5
      }
      projects.forEach(p => Object.freeze(p))
      projects.forEach(p => Object.freeze(p.categories))
      data.projects = Object.freeze(projects) as any
    } finally {
      data.loading = false
    }
  }
  async function search() {
    if (data.loading) return
    const route = router.currentRoute
    if (data.currentKeyword === '') {
      router.push({ query: { ...route.query, keyword: undefined } })
    } else {
      router.push({ query: { ...route.query, keyword: data.currentKeyword } })
    }
  }
  watch([index, refs.sort, refs.gameVersion, keyword], () => refresh())
  onMounted(() => {
    refresh()
  })
  return {
    ...refs,
    currentPage,
    search,
    refresh,
  }
}
