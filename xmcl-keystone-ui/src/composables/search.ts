import { InjectionKey } from 'vue'
import { useMarketSort } from './marketSort'
import { searlizers, useQuery, useQueryOverride } from './query'
import type { MaybeRef } from 'vue'
import { RuntimeVersions } from '@xmcl/instance'

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
  const modrinthEnvironment = ref('' as '' | 'client' | 'server')

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

  // Keep the game version filter aligned with the selected instance's Minecraft
  // version. This watcher lives for the whole app lifetime (the model is created
  // once in the root context), so it fires even when no search view is mounted —
  // covering instance switches and async instance loads where runtime.minecraft
  // transitions from '' to the real version. Without this, the mod detail page
  // could keep filtering files by a stale game version that no longer matches
  // the instance. Only re-sync when the filter was still tracking the instance
  // default (empty, or equal to the previous version), so an explicit user
  // override that intentionally differs from the instance version is preserved.
  watch(() => runtime.value.minecraft, (minecraft, oldMinecraft) => {
    if (!gameVersion.value || gameVersion.value === oldMinecraft) {
      gameVersion.value = minecraft
    }
  })

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
    useQueryOverride('modrinthEnvironment', modrinthEnvironment, '', searlizers.string)
    selectedCollection.value = undefined

    watch(runtime, () => {
      modLoader.value = getModloaders()
    }, { deep: true })
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
    modrinthEnvironment,
    effect,
  }
}