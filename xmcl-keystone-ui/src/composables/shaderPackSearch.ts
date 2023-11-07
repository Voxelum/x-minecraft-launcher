import { clientModrinthV2 } from '@/util/clients'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceData, Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDomainResources } from './resources'
import { useService } from './service'
import { useAggregateProjects, useProjectsFilterSearch } from './useAggregateProjects'
import { useModrinthSearch } from './modrinthSearch'

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
  }
}

export function useShaderPackSearch(runtime: Ref<InstanceData['runtime']>, shaderPack: Ref<string | undefined>) {
  const shaderLoaderFilters = ref(['iris', 'optifine'] as ShaderLoaderFilter[])
  const keyword: Ref<string> = ref('')
  const modrinthCategories = ref([] as string[])

  const { loadMoreModrinth, loadingModrinth, canModrinthLoadMore, modrinth, modrinthError } = useModrinthSearch<ShaderPackProject>('shader', keyword, shaderLoaderFilters, modrinthCategories, runtime)
  const { cached, loadingCached, shaderProjectFiles } = useLocalSearch(shaderPack)
  const loading = computed(() => loadingModrinth.value || loadingCached.value)

  const all = useAggregateProjects(
    modrinth,
    ref([]),
    ref([]),
    cached,
  )

  const items = useProjectsFilterSearch(
    keyword,
    all,
    computed(() => !keyword.value && modrinthCategories.value.length > 0),
  )

  return {
    shaderProjectFiles,
    modrinthCategories,
    shaderLoaderFilters,
    items,
    loadMoreModrinth,
    canModrinthLoadMore,
    modrinthError,
    loadingModrinth,
    cached,
    loadingCached,
    modrinth,
    keyword,
    loading,
  }
}
