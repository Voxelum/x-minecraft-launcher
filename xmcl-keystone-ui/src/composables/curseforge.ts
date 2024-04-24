import { clientCurseforgeV1 } from '@/util/clients'
import { formatKey } from '@/util/swrvGet'
import { MaybeRef, get } from '@vueuse/core'
import { File, FileModLoaderType, Mod, ModsSearchSortField } from '@xmcl/curseforge'
import useSWRV from 'swrv'
import { InjectionKey, Ref, computed, reactive, toRefs, watch } from 'vue'
import { kSWRVConfig, useOverrideSWRVConfig } from './swrvConfig'

export interface CurseforgeProps {
  classId: number
  page: number
  keyword: string
  category: number | undefined
  sortField: ModsSearchSortField | undefined
  modLoaderType: FileModLoaderType
  gameVersion: string
}

export function useCurseforge(
  classId: MaybeRef<number>,
  keyword: Ref<string>,
  page: Ref<number>,
  modLoaders: Ref<FileModLoaderType[]>,
  category: Ref<number | undefined>,
  sort: Ref<ModsSearchSortField | undefined>,
  gameVersion: Ref<string>,
  pageSize: MaybeRef<number> = 10,
) {
  const data = reactive({
    page: 0,
    pages: 5,
    totalCount: 0,
    projects: [] as Mod[],
  })

  const search = useCurseforgeSearchFunc(
    classId,
    keyword,
    modLoaders,
    category,
    sort,
    gameVersion,
    pageSize,
  )
  const { mutate, isValidating, error, data: _data } = useSWRV(
    computed(() => formatKey('/curseforge/search', {
      classId,
      keyword,
      modLoaders,
      category,
      sort,
      gameVersion,
      page,
      pageSize,
    })),
    async () => markRaw(search((page.value - 1) * get(pageSize))),
    useOverrideSWRVConfig({
      ttl: 30 * 1000,
    }))

  watch(_data, (v) => {
    if (v) {
      data.projects = markRaw(v.data)
      v.pagination.totalCount = Math.min(1_0000, v.pagination.totalCount)
      data.totalCount = v.pagination.totalCount
      data.pages = Math.ceil(v.pagination.totalCount / get(pageSize))
    }
  }, { immediate: true })
  return {
    ...toRefs(data),
    isValidating,
    error,
    mutate,
  }
}

export enum CurseforgeBuiltinClassId {
  mod = 6,
  modpack = 4471,
  resourcePack = 12,
  world = 17,
}

export function useCurseforgeSearchFunc(
  classId: MaybeRef<number>,
  keyword: Ref<string>,
  modLoaderFilters: Ref<FileModLoaderType[]>,
  curseforgeCategory: Ref<number | undefined>,
  sort: Ref<ModsSearchSortField | undefined>,
  gameVersion: Ref<string>,
  pageSize: MaybeRef<number>,
) {
  const mapping = [
    'Any',
    'Forge',
    'Cauldron',
    'LiteLoader',
    'Fabric',
    'Quilt',
  ]
  async function search(index: number) {
    let modLoaderType = undefined as FileModLoaderType | undefined
    let modLoaderTypes = undefined as string[] | undefined
    const types = get(modLoaderFilters)
    if (types.length === 1) {
      modLoaderType = types[0]
    } else {
      modLoaderTypes = types.map(t => mapping[t])
    }
    const result = await clientCurseforgeV1.searchMods({
      classId: get(classId),
      sortField: sort.value,
      modLoaderTypes,
      modLoaderType,
      gameVersion: gameVersion.value,
      searchFilter: keyword.value,
      categoryId: curseforgeCategory.value,
      pageSize: get(pageSize),
      index,
    })
    return result
  }

  return search
}

/**
 * Hook to view the curseforge project downloadable files.
 * @param projectId The project id
 */
export function useCurseforgeProjectFiles(projectId: Ref<number>, gameVersion: Ref<string | undefined>, modLoaderType: Ref<FileModLoaderType | undefined>) {
  const files = shallowRef([] as File[])
  const data = shallowReactive({
    index: 0,
    pageSize: 30,
    totalCount: 0,
  })
  const { mutate: refresh, isValidating: refreshing, error, data: _data } = useSWRV(
    computed(() => formatKey(`/curseforge/${projectId.value}/files`, {
      gameVersion,
      modLoaderType,
      index: data.index,
    })), async () => {
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

export function getCurseforgeProjectFilesModel(projectId: Ref<number>, gameVersion: Ref<string | undefined>, modLoaderType: Ref<FileModLoaderType | undefined>) {
  return {
    key: computed(() => formatKey(`/curseforge/${projectId.value}/files`, {
      gameVersion,
      modLoaderType,
    })),
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

export const kCurseforgeCategories: InjectionKey<ReturnType<typeof useCurseforgeCategories>> = Symbol('CurseforgeCategories')
