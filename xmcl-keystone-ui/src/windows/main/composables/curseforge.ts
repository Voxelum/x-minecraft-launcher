import { computed, onMounted, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api'
import { AddonInfo, Attachment, File } from '@xmcl/curseforge'
import { CurseForgeServiceKey, InstanceModsServiceKey, PersistedResource, ProjectType, ResourceServiceKey } from '@xmcl/runtime-api'
import { useBusy, useRouter, useService } from '/@/composables'

export interface CurseforgeProps {
  type: string
  page: number
  keyword: string
  category: string
  sort: string
  gameVersion: string
}

/**
 * Hook to return the controller of curseforge preview page. Navigating the curseforge projects.
 */
export function useCurseforge(props: CurseforgeProps) {
  const router = useRouter()
  const { searchProjects } = useService(CurseForgeServiceKey)
  const pageSize = 10

  const currentType = computed({
    get() { return props.type },
    set(v: string) {
      router.push(`/curseforge/${v}`)
    },
  })
  const currentSectionId = computed(() => {
    switch (props.type) {
      case 'modpacks':
        return 4471
      case 'texture-packs':
        return 12
      case 'worlds':
        return 17
      case 'customization':
        return 4546
      case 'mc-mods':
      default:
        return 6
    }
  })
  const currentPage = computed({
    get() { return props.page },
    set(v: number) {
      router.replace({ query: { ...router.currentRoute.query, page: v.toString() } })
    },
  })
  const currentCategory = computed({
    get() { return props.category },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, category: v } })
    },
  })
  const currentSort = computed({
    get() { return props.sort },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, sort: v } })
    },
  })
  const currentKeyword = computed({
    get() { return props.keyword },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, keyword: v } })
    },
  })
  const currentVersion = computed({
    get() { return props.gameVersion },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, gameVersion: v } })
    },
  })
  const categoryId = computed({
    get() { return Number.isInteger(currentCategory.value) ? Number.parseInt(currentCategory.value, 10) : undefined },
    set(v: number | undefined) {
      if (v) {
        currentCategory.value = v.toString()
      } else {
        currentCategory.value = ''
      }
    },
  })

  const data = reactive({
    pages: 5,
    projects: [] as AddonInfo[],
    loading: false,
  })
  const index = computed(() => (currentPage.value - 1) * pageSize)
  async function refresh() {
    data.loading = true
    try {
      const projects = await searchProjects({
        pageSize,
        index: index.value,
        sectionId: currentSectionId.value,
        sort: Number.isInteger(currentSort.value) ? Number.parseInt(currentSort.value, 10) : undefined,
        gameVersion: currentVersion.value,
        categoryId: categoryId.value,
        searchFilter: currentKeyword.value,
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
  watch([currentPage, currentSort, currentVersion, currentKeyword, currentCategory, currentType], () => {
    refresh()
  })
  onMounted(() => { refresh() })
  return {
    ...toRefs(data),
    categoryId,
    currentSort,
    currentVersion,
    currentKeyword,
    currentPage,
    currentCategory,
    currentType,
    refresh,
  }
}

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
