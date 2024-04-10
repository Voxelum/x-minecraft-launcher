import { clientModrinthV2 } from '@/util/clients'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceData, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useMarketSort } from './marketSort'
import { useModrinthSearch } from './modrinthSearch'
import { useDomainResources } from './resources'
import { useService } from './service'
import { useAggregateProjects, useProjectsFilterSearch } from './useAggregateProjects'

export const kShaderPackSearch: InjectionKey<ReturnType<typeof useShaderPackSearch>> = Symbol('ShaderPackSearch')

export enum ShaderLoaderFilter {
  optifine = 'optifine',
  iris = 'iris',
}

/**
 * Represent a mod project
 */
export type ShaderPackProject = ProjectEntry

function useLocalSearch(shaderPack: Ref<string | undefined>) {
  const { resources: shaderFiles } = useDomainResources(ResourceDomain.ShaderPacks)

  const shaderProjectFiles = computed(() => {
    return shaderFiles.value.map(s => {
      const enabled = shaderPack.value === s.fileName
      const file: ProjectFile = markRaw({
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

  const result = computed(() => {
    const indices: Record<string, ShaderPackProject> = {}
    const _all: ShaderPackProject[] = []

    const getFromResource = (m: ProjectFile) => {
      const curseforgeId = m.curseforge?.projectId
      const modrinthId = m.modrinth?.projectId
      const name = m.resource.name
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
      const mod = getFromResource(m)
      if (mod) {
        _all.push(mod)
      }
    }

    return markRaw(_all)
  })

  const loadingCached = ref(false)

  return {
    shaderProjectFiles,
    cached: result,
    loadingCached,
    shaderFiles,
  }
}

export function useShaderPackSearch(runtime: Ref<InstanceData['runtime']>, shaderPack: Ref<string | undefined>) {
  const shaderLoaderFilters = ref(['iris', 'optifine'] as ShaderLoaderFilter[])
  const keyword: Ref<string> = ref('')
  const gameVersion = ref('')
  const modrinthCategories = ref([] as string[])
  const isCurseforgeActive = ref(true)
  const isModrinthActive = ref(true)
  const { sort, modrinthSort } = useMarketSort(0)

  watch(runtime, (r) => {
    gameVersion.value = r.minecraft
  }, { immediate: true })

  const { loadMoreModrinth, loadingModrinth, modrinth, modrinthError } = useModrinthSearch<ShaderPackProject>('shader', keyword, shaderLoaderFilters, modrinthCategories, modrinthSort, gameVersion)
  const { cached, loadingCached, shaderProjectFiles } = useLocalSearch(shaderPack)
  const loading = computed(() => loadingModrinth.value || loadingCached.value)

  const all = useAggregateProjects(
    modrinth,
    ref([]),
    ref([]),
    cached,
  )

  const networkOnly = computed(() => keyword.value.length > 0 || modrinthCategories.value.length > 0)

  const items = useProjectsFilterSearch(
    keyword,
    all,
    networkOnly,
    isCurseforgeActive,
    isModrinthActive,
  )

  return {
    networkOnly,
    gameVersion,
    shaderProjectFiles,
    modrinthCategories,
    shaderLoaderFilters,
    items,
    loadMoreModrinth,
    sort,
    isModrinthActive,
    modrinthError,
    loadingModrinth,
    cached,
    loadingCached,
    modrinth,
    keyword,
    loading,
  }
}
