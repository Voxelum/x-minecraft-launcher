import { basename } from '@/util/basename'
import { ProjectEntry } from '@/util/search'
import { InstanceData } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { InstanceShaderFile } from './instanceShaderPack'
import { useMarketSort } from './marketSort'
import { useModrinthSearch } from './modrinthSearch'
import { searlizers, useQueryOverride } from './query'
import { useAggregateProjectsSplitted, useProjectsFilterSort } from './useAggregateProjects'
import { useCurseforgeSearch } from './curseforgeSearch'
import { ModFile } from '@/util/mod'
import { CurseforgeBuiltinClassId } from './curseforge'

export const kShaderPackSearch: InjectionKey<ReturnType<typeof useShaderPackSearch>> = Symbol('ShaderPackSearch')

export enum ShaderLoaderFilter {
  optifine = 'optifine',
  iris = 'iris',
}

/**
 * Represent a mod project
 */
export type ShaderPackProject = ProjectEntry<InstanceShaderFile>

function useLocalSearch(shaderProjectFiles: Ref<InstanceShaderFile[]>, keyword: Ref<string>) {
  const result = computed(() => {
    const indices: Record<string, ShaderPackProject> = {}
    const _enabled: ShaderPackProject[] = markRaw([])
    const _disabled: ShaderPackProject[] = markRaw([])

    const getFromResource = (m: InstanceShaderFile) => {
      const curseforgeId = m.curseforge?.projectId
      const modrinthId = m.modrinth?.projectId
      const name = basename(m.path)
      const obj = indices[name] || (modrinthId && indices[modrinthId]) || (curseforgeId && indices[curseforgeId])
      if (obj) {
        obj.installed?.push(m)
        obj.files?.push(m)
        obj.disabled = m.enabled ? false : obj.disabled
      } else {
        const proj: ShaderPackProject = markRaw({
          id: name,
          author: '',
          icon: '',
          title: name,
          disabled: !m.enabled,
          description: name,
          installed: [m],
          downloadCount: 0,
          followerCount: 0,
          modrinthProjectId: modrinthId,
          curseforgeProjectId: curseforgeId,
          files: [m],
        })
        indices[name] = proj
        if (modrinthId) {
          indices[modrinthId] = proj
        }
        if (curseforgeId) {
          indices[curseforgeId] = proj
        }
        return proj
      }
    }

    for (const m of shaderProjectFiles.value) {
      if (!m.fileName.toLowerCase().includes(keyword.value.toLowerCase())) {
        continue
      }
      const mod = getFromResource(m)
      if (mod) {
        if (m.enabled) {
          _enabled.push(mod)
        } else {
          _disabled.push(mod)
        }
      }
    }

    return [
      _enabled,
      _disabled,
    ]
  })

  const loadingCached = ref(false)

  function effect() {
  }

  return {
    shaderProjectFiles,
    enabled: computed(() => result.value[0]),
    disabled: computed(() => result.value[1]),
    loadingCached,
    effect,
  }
}

export function useShaderPackSearch(runtime: Ref<InstanceData['runtime']>, shaderPacks: Ref<InstanceShaderFile[]>) {
  const keyword: Ref<string> = ref('')
  const gameVersion = ref('')
  const shaderLoaderFilters = ref(['iris', 'optifine'] as ShaderLoaderFilter[])
  const modrinthCategories = ref([] as string[])
  const curseforgeCategory = ref(undefined as number | undefined)
  const isCurseforgeActive = ref(true)
  const isModrinthActive = ref(true)
  const sort = ref(0)
  const localOnly = ref(false)
  const { modrinthSort, curseforgeSort } = useMarketSort(sort)

  const { loadMoreModrinth, loadingModrinth, modrinth, modrinthError, effect: modrinthEffect } = useModrinthSearch<ShaderPackProject>('shader', keyword, shaderLoaderFilters, modrinthCategories, modrinthSort, gameVersion, localOnly)
  const { loadMoreCurseforge, loadingCurseforge, curseforge, curseforgeError, effect: onCurseforgeEffect } = useCurseforgeSearch<ProjectEntry<ModFile>>(CurseforgeBuiltinClassId.shaderPack, keyword, ref(undefined), curseforgeCategory, curseforgeSort, gameVersion, localOnly)
  const { enabled, disabled, loadingCached, shaderProjectFiles, effect: localEffect } = useLocalSearch(shaderPacks, keyword)
  const loading = computed(() => loadingModrinth.value || loadingCached.value || loadingCurseforge.value)

  function effect() {
    modrinthEffect()
    onCurseforgeEffect()
    localEffect()

    useQueryOverride('keyword', keyword, '', searlizers.string)
    useQueryOverride('gameVersion', gameVersion, computed(() => runtime.value.minecraft), searlizers.string)
    useQueryOverride('modrinthCategories', modrinthCategories, [], searlizers.stringArray)
    useQueryOverride('isCurseforgeActive', isCurseforgeActive, true, searlizers.boolean)
    useQueryOverride('isModrinthActive', isModrinthActive, true, searlizers.boolean)
    useQueryOverride('sort', sort, 0, searlizers.number)
  }

  const {
    installed,
    notInstalledButCached,
    others,
  } = useAggregateProjectsSplitted(
    modrinth,
    curseforge,
    disabled,
    enabled,
  )

  const mode = computed(() => modrinthCategories.value.length > 0 ? 'online' : keyword.value ? 'all' : 'local')

  const _installed = useProjectsFilterSort(
    keyword,
    installed,
    mode,
    isCurseforgeActive,
    isModrinthActive,
  )
  const _notInstalledButCached = useProjectsFilterSort(
    keyword,
    notInstalledButCached,
    mode,
    isCurseforgeActive,
    isModrinthActive,
  )
  const _others = useProjectsFilterSort(
    keyword,
    others,
    mode,
    isCurseforgeActive,
    isModrinthActive,
  )

  function loadMore() {
    if (isModrinthActive.value) {
      loadMoreModrinth()
    }
    if (isCurseforgeActive.value) {
      loadMoreCurseforge()
    }
  }

  return {
    localOnly,
    gameVersion,
    shaderProjectFiles,
    modrinthCategories,
    curseforgeError,

    enabled: _installed,
    disabled: _notInstalledButCached,
    others: _others,

    curseforgeCategory,
    loadMore,
    sort,
    isModrinthActive,
    modrinthError,
    loadingModrinth,
    loadingCached,
    modrinth,
    keyword,
    loading,
    effect,
  }
}
