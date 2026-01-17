import { clientCurseforgeV1 } from '@/util/clients'
import { SWRVModel, formatKey } from '@/util/swrvGet'
import { MaybeRef, get } from '@vueuse/core'
import { File, FileModLoaderType, Mod, ModsSearchSortField } from '@xmcl/curseforge'
import useSWRV from 'swrv'
import { InjectionKey, Ref, computed, reactive, toRefs, watch } from 'vue'
import { kSWRVConfig, useOverrideSWRVConfig } from './swrvConfig'
import { UpstreamHeaderProps } from '@/views/HomeUpstreamHeader.vue'
import { getExpectedSize } from '@/util/size'
import { useDateString } from './date'

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
      data.projects = markRaw(v.data.map(markRaw))
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
  shaderPack = 6552,
  modpack = 4471,
  resourcePack = 12,
  world = 17,
}

export function useCurseforgeSearchFunc(
  classId: MaybeRef<number>,
  keyword: Ref<string>,
  loaders: Ref<FileModLoaderType[]>,
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
    const types = get(loaders)
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
      files.value = markRaw(f.data.map(markRaw))
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

export function getCurseforgeProjectFilesModel(projectId: Ref<number | undefined>, gameVersion: Ref<string | undefined>, modLoaderType: Ref<FileModLoaderType | undefined>) {
  return {
    key: computed(() => formatKey(`/curseforge/${projectId.value || ''}/files`, {
      gameVersion,
      modLoaderType,
    })),
    fetcher: () => !projectId.value ? Promise.resolve({
      data: [] as File[],
      pagination: {
        index: 0,
        pageSize: 0,
        totalCount: 0,
      },
    }) : clientCurseforgeV1.getModFiles({
      modId: projectId.value,
      gameVersion: gameVersion.value,
      modLoaderType: modLoaderType.value === 0 ? undefined : modLoaderType.value,
    }).then(v => {
      for (const d of v.data) {
        markRaw(d)
      }
      markRaw(v)
      return v
    }),
  }
}

export function useCurseforgeCategoryI18n() {
  const { t } = useI18n()
  const tCategory = (k: string) => {
    switch (k) {
      case 'API and Library': return t('curseforgeCategory.API and Library')
      case 'Addons': return t('curseforgeCategory.Addons')
      case 'Adventure': return t('curseforgeCategory.Adventure')
      case 'Adventure and RPG': return t('curseforgeCategory.Adventure and RPG')
      case 'Animated': return t('curseforgeCategory.Animated')
      case 'Armor, Tools, and Weapons': return t('curseforgeCategory.Armor, Tools, and Weapons')
      case 'Armor， Tools， and Weapons': return t('curseforgeCategory.Armor， Tools， and Weapons')
      case 'Combat / PvP': return t('curseforgeCategory.Combat / PvP')
      case 'Cosmetic': return t('curseforgeCategory.Cosmetic')
      case 'Creation': return t('curseforgeCategory.Creation')
      case 'Data Packs': return t('curseforgeCategory.Data Packs')
      case 'Education': return t('curseforgeCategory.Education')
      case 'Exploration': return t('curseforgeCategory.Exploration')
      case 'Extra Large': return t('curseforgeCategory.Extra Large')
      case 'FTB Official Pack': return t('curseforgeCategory.FTB Official Pack')
      case 'Fabric': return t('curseforgeCategory.Fabric')
      case 'FancyMenu': return t('curseforgeCategory.FancyMenu')
      case 'Font Packs': return t('curseforgeCategory.Font Packs')
      case 'Food': return t('curseforgeCategory.Food')
      case 'Game Map': return t('curseforgeCategory.Game Map')
      case 'Hardcore': return t('curseforgeCategory.Hardcore')
      case 'MCreator': return t('curseforgeCategory.MCreator')
      case 'Magic': return t('curseforgeCategory.Magic')
      case 'Map Based': return t('curseforgeCategory.Map Based')
      case 'Map and Information': return t('curseforgeCategory.Map and Information')
      case 'Medieval': return t('curseforgeCategory.Medieval')
      case 'Mini Game': return t('curseforgeCategory.Mini Game')
      case 'Miscellaneous': return t('curseforgeCategory.Miscellaneous')
      case 'Mod Support': return t('curseforgeCategory.Mod Support')
      case 'Modded World': return t('curseforgeCategory.Modded World')
      case 'Modern': return t('curseforgeCategory.Modern')
      case 'Multiplayer': return t('curseforgeCategory.Multiplayer')
      case 'Parkour': return t('curseforgeCategory.Parkour')
      case 'Photo Realistic': return t('curseforgeCategory.Photo Realistic')
      case 'Puzzle': return t('curseforgeCategory.Puzzle')
      case 'QoL': return t('curseforgeCategory.QoL')
      case 'Quests': return t('curseforgeCategory.Quests')
      case 'Redstone': return t('curseforgeCategory.Redstone')
      case 'Sci-Fi': return t('curseforgeCategory.Sci-Fi')
      case 'Server Utility': return t('curseforgeCategory.Server Utility')
      case 'Skyblock': return t('curseforgeCategory.Skyblock')
      case 'Small / Light': return t('curseforgeCategory.Small / Light')
      case 'Steampunk': return t('curseforgeCategory.Steampunk')
      case 'Storage': return t('curseforgeCategory.Storage')
      case 'Survival': return t('curseforgeCategory.Survival')
      case 'Tech': return t('curseforgeCategory.Tech')
      case 'Technology': return t('curseforgeCategory.Technology')
      case 'Traditional': return t('curseforgeCategory.Traditional')
      case 'Twitch Integration': return t('curseforgeCategory.Twitch Integration')
      case 'Utility & QoL': return t('curseforgeCategory.Utility & QoL')
      case 'Vanilla+': return t('curseforgeCategory.Vanilla+')
      case 'World Gen': return t('curseforgeCategory.World Gen')
      default: return k
    }
  }
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

export function getCurseforgeProjectModel(projectId: Ref<number | undefined>) {
  return {
    key: computed(() => projectId.value && `/curseforge/${projectId.value}`),
    fetcher: (v: any) => projectId.value ? clientCurseforgeV1.getMod(projectId.value) : undefined,
  } as SWRVModel<Mod | undefined>
}


export function useCurseforgeUpstreamHeader(project: Ref<Mod | undefined>) {
  const { t, te } = useI18n()
  const { getDateString } = useDateString()
  return computed(() => {
    if (!project.value) return undefined
    const result: UpstreamHeaderProps = {
      url: project.value.links.websiteUrl,
      icon: project.value.logo.url || '',
      title: project.value.name || '',
      description: project.value?.summary || '',
      categories: project.value.categories.map((c) => {
        return {
          text: te(`curseforgeCategory.${c?.name}`) ? t(`curseforgeCategory.${c?.name}`) : c.name || '',
          icon: c.iconUrl || '',
          id: c.id.toString(),
        }
      }),
      type: 'curseforge',
      store: '/store/curseforge/' + project.value.id,
      infos: [{
        icon: 'file_download',
        name: t('modrinth.downloads'),
        value: getExpectedSize(project.value.downloadCount, ''),
      }, {
        icon: 'star_rate',
        name: t('modrinth.followers'),
        value: project.value.thumbsUpCount,
      }, {
        icon: 'event',
        name: t('modrinth.createAt'),
        value: getDateString(project.value.dateCreated, { dateStyle: 'long' }),
      }, {
        icon: 'update',
        name: t('modrinth.updateAt'),
        value: getDateString(project.value.dateModified, { dateStyle: 'long' }),
      }],
    }

    return result
  })
}

export function useCurseforgeCategories() {
  const { error, isValidating: refreshing, mutate: refresh, data: categories } = useSWRV('/curseforge/categories', async () => {
    const result = markRaw(await clientCurseforgeV1.getCategories()).map(markRaw).filter(c => !!c)
    return result
  }, inject(kSWRVConfig))
  return { categories, refreshing, refresh, error }
}

export const kCurseforgeCategories: InjectionKey<ReturnType<typeof useCurseforgeCategories>> = Symbol('CurseforgeCategories')
