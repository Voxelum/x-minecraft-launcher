import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { getModrinthProjectKey, getModrinthVersionKey } from '@/util/modrinth'
import { SWRVModel, swrvGet } from '@/util/swrvGet'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { IConfig } from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'
type ResolvedDependency = {
  project: Project
  versions: ProjectVersion[]
  recommendedVersion: ProjectVersion
  type: 'required' | 'optional' | 'incompatible' | 'embedded'
}

const visit = async (resolvedDep: ResolvedDependency, visited: Set<string>, config: IConfig): Promise<ResolvedDependency[]> => {
  const { recommendedVersion: version } = resolvedDep
  if (visited.has(version.project_id)) {
    return []
  }
  visited.add(version.project_id)
  const deps = await Promise.all(version.dependencies.map(async (dep) => {
    const project = await swrvGet(getModrinthProjectKey(dep.project_id), () => clientModrinthV2.getProject(dep.project_id), config.cache!, config.dedupingInterval!)
    const versions = await swrvGet(getModrinthVersionKey(dep.project_id, undefined, version.loaders, version.game_versions),
        () => clientModrinthV2.getProjectVersions(dep.project_id, { loaders: version.loaders, gameVersions: version.game_versions }),
        config.cache!, config.dedupingInterval!)
    if (dep.version_id) {
      const id = dep.version_id
      const recommendedVersion = versions.find(v => v.id === id)!
      const result = await visit({ project, versions, recommendedVersion, type: dep.dependency_type }, visited, config)
      return result
    } else {
      const result = await visit({ project, versions, recommendedVersion: versions[0], type: dep.dependency_type }, visited, config)
      return result
    }
  }))

  return [resolvedDep, ...deps.reduce((a, b) => [...a, ...b], [])]
}

export function getModrinthDependenciesModel(version: Ref<ProjectVersion | undefined>, config = injection(kSWRVConfig)): SWRVModel<ResolvedDependency[]> {
  const model = {
    key: computed(() => version.value && `/modrinth/version/${version.value.id}/dependencies`),
    fetcher: async () => {
      const visited = new Set<string>()
      const tuples = await visit({ recommendedVersion: version.value } as any, visited, config)
      tuples.shift()
      return tuples
    },
  }
  return model
}
