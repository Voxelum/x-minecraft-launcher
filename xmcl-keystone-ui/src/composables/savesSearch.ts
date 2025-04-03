import { ProjectEntry } from '@/util/search'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { InstanceSaveFile } from './instanceSave'
import { SearchModel } from './search'
import { useMergedProjects, useProjectsSort } from './useAggregateProjects'
import { useLocalStorageCacheStringValue } from './cache'
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
  const { loadMoreCurseforge: loadMore, loadingCurseforge: loading, curseforge, curseforgeError: error, effect: onCurseforgeEffect } = useCurseforgeSearch<ProjectEntry>(CurseforgeBuiltinClassId.world, searchModel)

  const { instanceSaves, sharedSaves: _sharedSaves } = useSaveLocalSearch(searchModel, saves, sharedSaves)
  const { currentView, keyword } = searchModel

  const result = useMergedProjects(
    computed(() => {
      const view = currentView.value
      if (view === 'local') {
        return [instanceSaves.value, _sharedSaves.value]
      }
      if (view === 'favorite') {
        return [instanceSaves.value, _sharedSaves.value]
      }
      return [
        curseforge.value,
        [..._sharedSaves.value, ...instanceSaves.value],
      ]
    }),
  )

  const items = useProjectsSort(
    keyword,
    result,
  )

  function effect() {
    onCurseforgeEffect()
    searchModel.effect(() => undefined)
  }

  const sortBy = useLocalStorageCacheStringValue('savesSort', '' as LocalSort)

  return {
    sortBy,
    loading,
    error,
    loadMore,
    effect,
    items,
  }
}
