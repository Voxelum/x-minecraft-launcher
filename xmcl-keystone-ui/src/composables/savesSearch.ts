import { ProjectEntry } from '@/util/search'
import { InstanceSavesServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { InstanceSaveFile } from './instanceSave'
import { useMarketSort } from './marketSort'
import { searlizers, useQueryOverride } from './query'
import { useAggregateProjectsSplitted, useProjectsFilterSort } from './useAggregateProjects'

export const kSaveSearch: InjectionKey<ReturnType<typeof useSavesSearch>> = Symbol('kSaveSearch')

function useSaveLocalSearch(keyword: Ref<string>, saves: Ref<InstanceSaveFile[]>, shared: Ref<InstanceSaveFile[]>) {
  const getProjectFromFile = (s: InstanceSaveFile) => {
    return {
      id: s.path,
      icon: s.icon,
      title: s.name ?? '',
      description: s.levelName ?? '',
      author: '',
      disabled: !s.enabled,
      installed: [s],
      files: [s],
    }
  }

  const instanceSaves = computed(() => {
    const result = [] as ProjectEntry[]

    for (const s of saves.value) {
      const name = s.name
      if (keyword.value && !name.toLowerCase().includes(keyword.value.toLowerCase())) {
        continue
      }

      result.push(getProjectFromFile(s))
    }

    return result
  })

  const sharedSaves = computed(() => {
    const result = [] as ProjectEntry[]

    for (const s of shared.value) {
      const name = s.name
      if (keyword.value && !name.toLowerCase().includes(keyword.value.toLowerCase())) {
        continue
      }

      result.push(getProjectFromFile(s))
    }
    console.log(result)
    return result
  })

  return {
    instanceSaves,
    sharedSaves,
  }
}

export function useSavesSearch(runtime: Ref<RuntimeVersions>, saves: Ref<InstanceSaveFile[]>, sharedSaves: Ref<InstanceSaveFile[]>) {
  const curseforgeCategory = ref(undefined as number | undefined)
  const keyword = ref('')
  const gameVersion = ref('')
  const sort = ref(0)

  const { curseforgeSort } = useMarketSort(sort)
  const isCurseforgeActive = ref(true)

  const { loadMoreCurseforge, loadingCurseforge, curseforge, curseforgeError, effect: onCurseforgeEffect } = useCurseforgeSearch<ProjectEntry>(CurseforgeBuiltinClassId.world, keyword, shallowRef(markRaw([])), curseforgeCategory, curseforgeSort, gameVersion)

  const { instanceSaves, sharedSaves: _sharedSaves } = useSaveLocalSearch(keyword, saves, sharedSaves)

  const {
    installed,
    notInstalledButCached,
    others,
  } = useAggregateProjectsSplitted(
    curseforge,
    ref([]),
    _sharedSaves,
    instanceSaves,
  )

  const networkOnly = computed(() => curseforgeCategory.value !== undefined)

  const _installed = useProjectsFilterSort(
    keyword,
    installed,
    networkOnly,
    isCurseforgeActive,
    ref(false),
  )
  const _notInstalledButCached = useProjectsFilterSort(
    keyword,
    notInstalledButCached,
    networkOnly,
    isCurseforgeActive,
    ref(false),
  )
  const _others = useProjectsFilterSort(
    keyword,
    others,
    networkOnly,
    isCurseforgeActive,
    ref(false),
  )

  function effect() {
    onCurseforgeEffect()
    // onLocalEffect()

    useQueryOverride('gameVersion', gameVersion, computed(() => runtime.value.minecraft), searlizers.string)
    useQueryOverride('curseforgeCategory', curseforgeCategory, undefined, searlizers.number)
    useQueryOverride('keyword', keyword, '', searlizers.string)
    useQueryOverride('sort', sort, 0, searlizers.number)
  }

  return {
    curseforge,
    loadingCurseforge,
    curseforgeError,
    loadMoreCurseforge,
    effect,

    installed: _installed,
    notInstalledButCached: _notInstalledButCached,
    others: _others,

    curseforgeCategory,
    keyword,
    gameVersion,
    sort,
    isCurseforgeActive,
  }
}
