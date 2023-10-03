import { clientCurseforgeV1 } from '@/util/clients'
import { File, FileModLoaderType, Mod, ModsSearchSortField } from '@xmcl/curseforge'
import useSWRV from 'swrv'
import { InjectionKey, Ref, computed, reactive, ref, toRefs, watch } from 'vue'
import { kSWRVConfig, useOverrideSWRVConfig } from './swrvConfig'

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
  const { mutate, isValidating, error, data: _data } = useSWRV(
    computed(() => `/curseforge/search?index=${index.value}&classId=${currentSectionId.value}&sortField=${currentSort.value}&gameVersion=${currentVersion.value}&categoryId=${categoryId.value}&searchFilter=${currentKeyword.value}`),
    async () => {
      const result = await clientCurseforgeV1.searchMods({
        pageSize,
        index: index.value,
        classId: currentSectionId.value,
        sortField: currentSort.value,
        gameVersion: currentVersion.value,
        categoryId: categoryId.value,
        searchFilter: currentKeyword.value,
      })
      return markRaw(result)
    }, useOverrideSWRVConfig({
      ttl: 30 * 1000,
    }))

  watch(_data, (v) => {
    if (v) {
      data.projects = markRaw(v.data)
      v.pagination.totalCount = Math.min(1_0000, v.pagination.totalCount)
      data.totalCount = v.pagination.totalCount
      data.pages = Math.ceil(v.pagination.totalCount / pageSize)
    }
  })
  return {
    ...toRefs(data),
    refreshing: isValidating,
    error,
    categoryId,
    currentSort,
    currentVersion,
    currentKeyword,
    currentPage,
    currentCategory,
    currentType,
    refresh: mutate,
  }
}

/**
 * Hook to view the curseforge project downloadable files.
 * @param projectId The project id
 */
export function useCurseforgeProjectFiles(projectId: Ref<number>, gameVersion: Ref<string | undefined>, modLoaderType: Ref<FileModLoaderType | undefined>) {
  const files = inject(kCurseforgeFiles, ref([]))
  const data = shallowReactive({
    index: 0,
    pageSize: 30,
    totalCount: 0,
  })
  const { mutate: refresh, isValidating: refreshing, error, data: _data } = useSWRV(
    computed(() => `/curseforge/${projectId.value}/files?gameVersion=${gameVersion.value}&modLoaderType=${modLoaderType.value}&index=${data.index}`), async () => {
      return markRaw(await clientCurseforgeV1.getModFiles({
        modId: projectId.value,
        index: data.index,
        gameVersion: gameVersion.value,
        pageSize: data.pageSize,
        modLoaderType: modLoaderType.value === 0 ? undefined : modLoaderType.value,
      }))
    }, inject(kSWRVConfig))
  watch(_data, (f) => {
    if (f) {
      files.value = markRaw(f.data)
      data.index = f.pagination.index
      data.pageSize = f.pagination.pageSize
      data.totalCount = f.pagination.totalCount
    }
  }, { immediate: true })
  return {
    ...toRefs(data),
    files,
    refresh,
    refreshing,
    error,
  }
}

export const kCurseforgeFiles: InjectionKey<Ref<File[]>> = Symbol('CurseforgeFiles')

export function useCurseforgeProjectDescription(props: { project: number }) {
  const { mutate: refresh, isValidating: refreshing, error, data: description } = useSWRV(
    computed(() => `/curseforge/${props.project}/description`), async () => {
      const text = await clientCurseforgeV1.getModDescription(props.project)
      const root = document.createElement('div')
      root.innerHTML = text
      const allLinks = root.getElementsByTagName('a')
      for (const link of allLinks) {
        if (link.href) {
          const parsed = new URL(link.href)
          const remoteUrl = parsed.searchParams.get('remoteUrl')
          if (remoteUrl) {
            link.href = decodeURIComponent(remoteUrl)
          }
        }
      }
      return root.innerHTML
    }, inject(kSWRVConfig))

  return { description, refreshing, refresh, error }
}
/**
 * Hook to view the front page of the curseforge project.
 * @param projectId The project id
 */
export function useCurseforgeProject(projectId: Ref<number>) {
  const { data: project, isValidating, mutate, error } = useSWRV(computed(() => `/curseforge/${projectId.value}`), async function () {
    return markRaw(await clientCurseforgeV1.getMod(projectId.value))
  }, inject(kSWRVConfig))
  return {
    refreshing: isValidating,
    refresh: mutate,
    project,
    error,
  }
}

export function useCurseforgeCategories() {
  const { error, isValidating: refreshing, mutate: refresh, data: categories } = useSWRV('/curseforge/categories', async () => {
    return markRaw(await clientCurseforgeV1.getCategories())
  }, inject(kSWRVConfig))
  return { categories, refreshing, refresh, error }
}
