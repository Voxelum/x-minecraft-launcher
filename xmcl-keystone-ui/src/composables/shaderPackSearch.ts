import { basename } from '@/util/basename'
import { clientModrinthV2 } from '@/util/clients'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceData, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { InstanceShaderFile } from './instanceShaderPack'
import { useMarketSort } from './marketSort'
import { useModrinthSearch } from './modrinthSearch'
import { searlizers, useQueryOverride } from './query'
import { useDomainResources } from './resources'
import { useService } from './service'
import { useAggregateProjectsSplitted, useProjectsFilterSort } from './useAggregateProjects'

export const kShaderPackSearch: InjectionKey<ReturnType<typeof useShaderPackSearch>> = Symbol('ShaderPackSearch')

export enum ShaderLoaderFilter {
  optifine = 'optifine',
  iris = 'iris',
}

/**
 * Represent a mod project
 */
export type ShaderPackProject = ProjectEntry<InstanceShaderFile>

function useLocalSearch(shaderPack: Ref<string | undefined>, keyword: Ref<string>) {
  const { resources: shaderFiles } = useDomainResources(ResourceDomain.ShaderPacks)

  const shaderProjectFiles = computed(() => {
    return shaderFiles.value.map(s => {
      const enabled = shaderPack.value === s.fileName
      const file: InstanceShaderFile = markRaw({
        path: s.path,
        version: '',
        resource: s,
        enabled,
        modrinth: s.metadata.modrinth,
        curseforge: s.metadata.curseforge,
      })
      return file
    })
  })

  const { updateResources } = useService(ResourceServiceKey)

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
      if (!m.resource.fileName.toLowerCase().includes(keyword.value.toLowerCase())) {
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
    watch(shaderFiles, async (files) => {
      const absent = files.filter(f => !f.metadata.modrinth)
      const versions = await clientModrinthV2.getProjectVersionsByHash(absent.map(a => a.hash))
      const options = Object.entries(versions).map(([hash, version]) => {
        const f = files.find(f => f.hash === hash)
        if (f) return { hash: f.hash, metadata: { modrinth: { projectId: version.project_id, versionId: version.id } } }
        return undefined
      }).filter((v): v is any => !!v)
      if (options.length > 0) {
        console.log('update shader packs', options)
        updateResources(options)
      }
    }, { immediate: true })
  }

  return {
    shaderProjectFiles,
    enabled: computed(() => result.value[0]),
    disabled: computed(() => result.value[1]),
    loadingCached,
    shaderFiles,
    effect,
  }
}

export function useShaderPackSearch(runtime: Ref<InstanceData['runtime']>, shaderPack: Ref<string | undefined>) {
  const keyword: Ref<string> = ref('')
  const gameVersion = ref('')
  const shaderLoaderFilters = ref(['iris', 'optifine'] as ShaderLoaderFilter[])
  const modrinthCategories = ref([] as string[])
  const isCurseforgeActive = ref(true)
  const isModrinthActive = ref(true)
  const sort = ref(0)
  const { modrinthSort } = useMarketSort(sort)

  const { loadMoreModrinth, loadingModrinth, modrinth, modrinthError, effect: modrinthEffect } = useModrinthSearch<ShaderPackProject>('shader', keyword, shaderLoaderFilters, modrinthCategories, modrinthSort, gameVersion)
  const { enabled, disabled, loadingCached, shaderProjectFiles, effect: localEffect } = useLocalSearch(shaderPack, keyword)
  const loading = computed(() => loadingModrinth.value || loadingCached.value)

  function effect() {
    modrinthEffect()
    localEffect()

    useQueryOverride('keyword', keyword, '', searlizers.string)
    useQueryOverride('gameVersion', gameVersion, computed(() => runtime.value.minecraft), searlizers.string)
    useQueryOverride('modrinthCategories', modrinthCategories, [], searlizers.stringArray)
    useQueryOverride('shaderLoaderFilters', shaderLoaderFilters, ['iris', 'optifine'], searlizers.stringArray)
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
    ref([]),
    disabled,
    enabled,
  )

  const networkOnly = computed(() => modrinthCategories.value.length > 0)

  const _installed = useProjectsFilterSort(
    keyword,
    installed,
    networkOnly,
    isCurseforgeActive,
    isModrinthActive,
  )
  const _notInstalledButCached = useProjectsFilterSort(
    keyword,
    notInstalledButCached,
    networkOnly,
    isCurseforgeActive,
    isModrinthActive,
  )
  const _others = useProjectsFilterSort(
    keyword,
    others,
    networkOnly,
    isCurseforgeActive,
    isModrinthActive,
  )

  return {
    gameVersion,
    shaderProjectFiles,
    modrinthCategories,
    shaderLoaderFilters,

    enabled: _installed,
    disabled: _notInstalledButCached,
    others: _others,

    loadMoreModrinth,
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
