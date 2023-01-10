import { computed, onMounted, reactive, ref, toRefs, watch } from 'vue'
import { File, FileModLoaderType, Mod, ModCategory, ModsSearchSortField } from '@xmcl/curseforge'
import { CurseForgeServiceKey, Persisted, ProjectType, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { useRefreshable, useService, useServiceBusy } from '@/composables'

interface CurseforgeProps {
  type: string
  page: number
  keyword: string
  category: string
  sortField: ModsSearchSortField
  modLoaderType: FileModLoaderType
  sortOrder: 'asc' | 'desc'
  gameVersion: string
  from: string
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
      router.replace({ query: { ...router.currentRoute.query, category: v, page: '1' } })
    },
  })
  const currentSort = computed({
    get() { return props.sortField },
    set(v: ModsSearchSortField) {
      router.replace({ query: { ...router.currentRoute.query, sortField: v.toString() } })
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
    get() { return currentCategory.value ? Number.parseInt(currentCategory.value, 10) : undefined },
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
    totalCount: 0,
    projects: [] as Mod[],
  })
  const index = computed(() => (currentPage.value - 1) * pageSize)
  const { refresh, refreshing, error } = useRefreshable(async function refresh() {
    const { data: result, pagination } = await searchProjects({
      pageSize,
      index: index.value,
      classId: currentSectionId.value,
      sortField: currentSort.value,
      gameVersion: currentVersion.value,
      categoryId: categoryId.value,
      searchFilter: currentKeyword.value,
    })
    data.totalCount = pagination.totalCount
    data.projects = Object.freeze(result) as any
    data.pages = Math.floor(data.totalCount / pageSize)
    data.projects.forEach(p => Object.freeze(p))
    data.projects.forEach(p => Object.freeze(p.categories))
  })
  watch([currentPage, currentSort, currentVersion, currentKeyword, currentCategory, currentType], () => {
    refresh()
  })
  onMounted(() => { refresh() })
  return {
    ...toRefs(data),
    refreshing,
    error,
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
  const { getModFiles } = useService(CurseForgeServiceKey)
  const data = reactive({
    files: [] as File[],
    index: 0,
    pageSize: 0,
    totalCount: 0,
  })
  const { refresh, refreshing, error } = useRefreshable(async () => {
    const f = await getModFiles({ modId: projectId })
    data.files = markRaw(f.data)
    data.index = f.pagination.index
    data.pageSize = f.pagination.pageSize
    data.totalCount = f.pagination.totalCount
  })
  onMounted(() => {
    refresh()
  })
  return {
    ...toRefs(data),
    refresh,
    refreshing,
    error,
  }
}

export function useCurseforgeProjectDescription(projectId: number) {
  const { getModDescription } = useService(CurseForgeServiceKey)
  const data = reactive({
    description: '',
  })
  const { refresh, refreshing, error } = useRefreshable(async function refresh() {
    const des = await getModDescription(projectId)
    data.description = des
  })

  onMounted(() => {
    refresh()
  })
  return { ...toRefs(data), refreshing, refresh, error }
}
/**
 * Hook to view the front page of the curseforge project.
 * @param projectId The project id
 */
export function useCurseforgeProject(projectId: number) {
  const { getMod } = useService(CurseForgeServiceKey)
  const project = ref(undefined as undefined | Mod)
  const refreshing = useServiceBusy(CurseForgeServiceKey, 'getMod', projectId.toString())
  const { refresh, error } = useRefreshable(async function () {
    project.value = await getMod(projectId)
  })
  onMounted(() => refresh())
  return {
    refreshing,
    project,
    error,
  }
}

export function useCurseforgeCategories() {
  const { fetchCategories } = useService(CurseForgeServiceKey)
  const categories = ref([] as ModCategory[])
  const refreshing = useServiceBusy(CurseForgeServiceKey, 'fetchCategories')
  async function refresh() {
    categories.value = await fetchCategories()
  }
  onMounted(() => {
    refresh()
  })
  return { categories, refreshing, refresh }
}
