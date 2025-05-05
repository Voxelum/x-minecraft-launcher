import { RuntimeVersions } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useMarketSort } from './marketSort'
import { searlizers, useQuery, useQueryOverride } from './query'
import { MaybeRef } from '@vueuse/core'

/**
 * The common modloader for modrinth and curseforge
 */
export enum ModLoaderFilter {
  fabric = 'fabric',
  forge = 'forge',
  quilt = 'quilt',
  neoforge = 'neoforge',
}

export type SearchModel = ReturnType<typeof useSearchModel>

export const kSearchModel: InjectionKey<SearchModel> = Symbol('SearchModel')

export function useSearchModel(runtime: Ref<RuntimeVersions>) {
  const keyword = ref('')
  const modLoader = ref<string | undefined>(undefined)
  const modLoaders = computed(() => modLoader.value ? [modLoader.value] : [] as string[]) as MaybeRef<string[]>
  const gameVersion = ref('')
  const modrinthCategories = ref([] as string[])
  const curseforgeCategory = ref(undefined as number | undefined)
  const sort = ref(0)
  const isCurseforgeActive = ref(true)
  const isModrinthActive = ref(true)
  const source = ref('remote' as 'local' | 'remote' | 'favorite')
  const notRemote = computed(() => source.value !== 'remote')
  const selectedCollection = ref(undefined as string | undefined)

  const currentView = computed(() => {
    const sourceValue = source.value
    if (sourceValue === 'local') {
      return 'local'
    }

    if (sourceValue === 'favorite') {
      return 'favorite'
    }

    return 'remote'
  })

  const { modrinthSort, curseforgeSort } = useMarketSort(sort)

  const isModrinthDisabled = computed(() => notRemote.value || !isModrinthActive.value)
  const isCurseforgeDisabled = computed(() => notRemote.value || !isCurseforgeActive.value)

  function effect(getModloaders: () => string | undefined) {
    useQueryOverride('keyword', keyword, '', searlizers.string)
    useQueryOverride('gameVersion', gameVersion, computed(() => runtime.value.minecraft), searlizers.string)
    useQueryOverride('modLoader', modLoader, computed(() => getModloaders()), {
      fromString: (v) => !v ? undefined : v,
      toString: (v) => v || '',
    })
    useQueryOverride('modLoaders', modrinthCategories, [], searlizers.stringArray)
    useQueryOverride('curseforgeCategory', curseforgeCategory, undefined, searlizers.number)
    useQueryOverride('sort', sort, 0, searlizers.number)
    useQueryOverride('curseforgeActive', isCurseforgeActive, true, searlizers.boolean)
    useQueryOverride('modrinthActive', isModrinthActive, true, searlizers.boolean)
    useQueryOverride('source', source, 'local', searlizers.string)
    selectedCollection.value = undefined
  }

  return {
    modLoader,
    modLoaders,
    keyword,
    gameVersion,
    modrinthCategories,
    curseforgeCategory,
    sort,
    isCurseforgeActive,
    isModrinthActive,
    source,
    currentView,
    notRemote,
    selectedCollection,
    modrinthSort,
    curseforgeSort,
    isModrinthDisabled,
    isCurseforgeDisabled,
    effect,
  }
}