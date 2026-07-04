import { ProjectEntry } from '@/util/search'
import { mergeSorted } from '@/util/sort'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { InstanceSaveFile } from './instanceSave'
import { useModrinthSearch } from './modrinthSearch'
import { SearchModel } from './search'
import { useMergedProjects, useProjectsSort } from './useMergedProjects'
import { useLocalStorage } from '@vueuse/core'
import { LocalSort } from './sortBy'

export const kSaveSearch: InjectionKey<ReturnType<typeof useSavesSearch>> = Symbol('kSaveSearch')

function useSaveLocalSearch({ keyword }: SearchModel, saves: Ref<InstanceSaveFile[]>, shared: Ref<InstanceSaveFile[]>) {
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
    return result
  })

  return {
    instanceSaves,
    sharedSaves,
  }
}

export function useSavesSearch(saves: Ref<InstanceSaveFile[]>, sharedSaves: Ref<InstanceSaveFile[]>,
  searchModel: SearchModel) {
  // The save market mixes two content types:
  // - Worlds (CurseForge only, classId 17) filtered by `curseforgeCategory`
  // - Data packs (CurseForge classId 6945 + Modrinth `datapack`) which are
  //   installed per-save. Data packs get their own CurseForge category ref so
  //   they don't collide with the world category namespace.
  const curseforgeDatapackCategory = ref<number | undefined>(undefined)

  const {
    loadMoreCurseforge: loadMoreWorlds, loadingCurseforge: loadingWorlds,
    curseforge: worlds, curseforgeError: worldsError, effect: onWorldsEffect,
  } = useCurseforgeSearch<ProjectEntry>(CurseforgeBuiltinClassId.world, searchModel)

  const {
    loadMoreCurseforge: loadMoreCfDatapacks, loadingCurseforge: loadingCfDatapacks,
    curseforge: cfDatapacks, curseforgeError: cfDatapacksError, effect: onCfDatapacksEffect,
  } = useCurseforgeSearch<ProjectEntry>(CurseforgeBuiltinClassId.datapack, {
    ...searchModel,
    curseforgeCategory: curseforgeDatapackCategory,
  })

  const {
    loadMoreModrinth: loadMoreMrDatapacks, loadingModrinth: loadingMrDatapacks,
    modrinth: mrDatapacks, modrinthError: mrDatapacksError, effect: onMrDatapacksEffect,
  } = useModrinthSearch<ProjectEntry>('datapack', searchModel)

  const { instanceSaves, sharedSaves: _sharedSaves } = useSaveLocalSearch(searchModel, saves, sharedSaves)
  const { currentView, keyword } = searchModel

  // Tag data pack results so the view can reliably distinguish them from worlds
  // regardless of CurseForge classId gaps or Modrinth's `project_type: mod`.
  const datapacks = computed(() => {
    const tag = (p: ProjectEntry) => { p.contentType = 'datapack'; return p }
    return mergeSorted(cfDatapacks.value.map(tag), mrDatapacks.value.map(tag))
  })

  const result = useMergedProjects(
    computed(() => {
      const view = currentView.value
      if (view === 'local') {
        return [[...instanceSaves.value, ..._sharedSaves.value], []]
      }
      if (view === 'favorite') {
        return [[...instanceSaves.value, ..._sharedSaves.value], []]
      }
      return [
        mergeSorted(worlds.value, datapacks.value),
        [..._sharedSaves.value, ...instanceSaves.value],
      ]
    }),
  )

  const items = useProjectsSort(
    keyword,
    result,
    currentView,
  )

  const loading = computed(() => loadingWorlds.value || loadingCfDatapacks.value || loadingMrDatapacks.value)
  const error = computed(() => worldsError.value || cfDatapacksError.value || mrDatapacksError.value)

  function effect() {
    onWorldsEffect()
    onCfDatapacksEffect()
    onMrDatapacksEffect()
    searchModel.effect(() => undefined)
  }

  function loadMore() {
    loadMoreWorlds()
    loadMoreCfDatapacks()
    loadMoreMrDatapacks()
  }

  const sortBy = useLocalStorage<LocalSort>('savesSort', '' as LocalSort, { writeDefaults: false })

  return {
    sortBy,
    loading,
    error,
    loadMore,
    effect,
    items,
    curseforgeDatapackCategory,
  }
}
