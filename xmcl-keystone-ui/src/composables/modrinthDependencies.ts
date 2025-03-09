import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { getModrinthProjectKey, getModrinthVersionKey } from '@/util/modrinth'
import { SWRVModel, swrvGet } from '@/util/swrvGet'
import { MaybeRef, get } from '@vueuse/core'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { IConfig } from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'

type ResolvedDependency = {
  project: Project
  versions: ProjectVersion[]
  recommendedVersion: ProjectVersion
  /**
   * The type of the dependency relative to the root mod
   */
  type: 'required' | 'optional' | 'incompatible' | 'embedded'
  /**
   * The type of the dependency relative to the parent mod
   */
  relativeType: 'required' | 'optional' | 'incompatible' | 'embedded'

  parent: Project
}

const visit = async (current: ResolvedDependency, visited: Set<string>, config: IConfig, modLoader?: MaybeRef<string | undefined>): Promise<ResolvedDependency[]> => {
  const { recommendedVersion: version } = current
  if (current.relativeType === 'incompatible' || current.type === 'embedded') {
    return []
  }
  if (visited.has(version.project_id)) {
    return []
  }
  visited.add(version.project_id)
  const deps = await Promise.all(version.dependencies.map(async (child) => {
    const loaders = version.loaders
    const project = await swrvGet(getModrinthProjectKey(child.project_id), () => clientModrinthV2.getProject(child.project_id), config.cache!, config.dedupingInterval!)
    const versions = await swrvGet(getModrinthVersionKey(child.project_id, undefined, loaders, version.game_versions),
      () => clientModrinthV2.getProjectVersions(child.project_id, { loaders, gameVersions: version.game_versions }),
      config.cache!, config.dedupingInterval!)
    const recommendedVersion = child.version_id ? versions.find(v => v.id === child.version_id)! : versions[0]
    const result = await visit(markRaw({
      project,
      versions,
      recommendedVersion,
      parent: current.project,
      type: child.dependency_type === 'required'
        ? current.type === 'required' ? 'required' : current.type || child.dependency_type
        : child.dependency_type,
      relativeType: child.dependency_type,
    }), visited, config)
    return result
  }))

  return [current, ...deps.reduce((a, b) => [...a, ...b], [])]
}

export function getModrinthDependenciesModel(version: Ref<ProjectVersion | undefined>, modLoader?: MaybeRef<string | undefined>, config = injection(kSWRVConfig)): SWRVModel<ResolvedDependency[]> {
  const model = {
    key: computed(() => version.value && `/modrinth/version/${version.value.id}/dependencies?${get(modLoader)}`),
    fetcher: async () => {
      const visited = new Set<string>()
      const tuples = await visit({ recommendedVersion: version.value } as any, visited, config, modLoader)
      tuples.shift()
      return tuples
    },
  }
  return model
}
