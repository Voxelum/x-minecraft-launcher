import { clientCurseforgeV1 } from '@/util/clients'
import { File, FileModLoaderType, Mod, ModsSearchSortField } from '@xmcl/curseforge'
import useSWRV from 'swrv'
import { InjectionKey, Ref, computed, reactive, ref, toRefs, watch } from 'vue'
import { kSWRVConfig, useOverrideSWRVConfig } from './swrvConfig'

export interface CurseforgeProps {
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
  const pageSize = 10

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
  const categoryId = computed({
    get() { return props.category ? Number.parseInt(props.category, 10) : undefined },
    set(v: number | undefined) {
      if (v) {
        props.category = v.toString()
      } else {
        props.category = ''
      }
    },
  })

  const data = reactive({
    pages: 5,
    totalCount: 0,
    projects: [] as Mod[],
  })
  const index = computed(() => (props.page - 1) * pageSize)
  const { mutate, isValidating, error, data: _data } = useSWRV(
    computed(() => `/curseforge/search?index=${index.value}&classId=${currentSectionId.value}&sortField=${props.sortField}&gameVersion=${props.gameVersion}&categoryId=${categoryId.value}&searchFilter=${props.keyword}`),
    async () => {
      const result = await clientCurseforgeV1.searchMods({
        pageSize,
        index: index.value,
        classId: currentSectionId.value,
        sortField: props.sortField,
        modLoaderType: props.modLoaderType === 0 ? undefined : props.modLoaderType,
        gameVersion: props.gameVersion,
        categoryId: categoryId.value,
        searchFilter: props.keyword,
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
  }, { immediate: true })
  return {
    ...toRefs(data),
    refreshing: isValidating,
    error,
    categoryId,
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

export function getCurseforgeProjectFilesModel(projectId: Ref<number>, gameVersion: Ref<string | undefined>, modLoaderType: Ref<FileModLoaderType | undefined>) {
  return {
    key: computed(() => `/curseforge/${projectId.value}/files?gameVersion=${gameVersion.value}&modLoaderType=${modLoaderType.value}`),
    fetcher: () => clientCurseforgeV1.getModFiles({
      modId: projectId.value,
      gameVersion: gameVersion.value,
      modLoaderType: modLoaderType.value === 0 ? undefined : modLoaderType.value,
    }),
  }
}

export function useCurseforgeCategoryI18n() {
  const { te, t } = useI18n()
  const tCategory = (k: string) => te(`curseforgeCategory.${k}`) ? t(`curseforgeCategory.${k}`) : k
  return tCategory
}

export function getCurseforgeProjectDescriptionModel(projectId: Ref<number>) {
  return {
    key: computed(() => `/curseforge/${projectId.value}/description`),
    fetcher: async () => {
      const text = await clientCurseforgeV1.getModDescription(projectId.value)
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
    },
  }
}

export function getCurseforgeProjectModel(projectId: Ref<number>) {
  return {
    key: computed(() => `/curseforge/${projectId.value}`),
    fetcher: (v: any) => clientCurseforgeV1.getMod(projectId.value),
  }
}

export function useCurseforgeCategories() {
  const { error, isValidating: refreshing, mutate: refresh, data: categories } = useSWRV('/curseforge/categories', async () => {
    return markRaw(await clientCurseforgeV1.getCategories())
  }, inject(kSWRVConfig))
  return { categories, refreshing, refresh, error }
}
