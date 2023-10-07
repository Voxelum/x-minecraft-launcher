import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { swrvGet } from '@/util/swrvGet'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'
import { getModrinthProjectKey, getModrinthVersionKey } from '@/util/modrinth'

export function useModrinthDependencies(versionRef: Ref<ProjectVersion | undefined>) {
  const config = injection(kSWRVConfig)
  return useSWRV(computed(() => versionRef.value && `/modrinth/version/${versionRef.value.id}/dependencies`), async () => {
    const version = versionRef.value!
    const visited = new Set<string>()
    type ResolvedDependency = {
      project: Project
      versions: ProjectVersion[]
      recommendedVersion: ProjectVersion
      type: 'required' | 'optional' | 'incompatible' | 'embedded'
    }

    const visit = async (resolvedDep: ResolvedDependency): Promise<ResolvedDependency[]> => {
      const { recommendedVersion: version } = resolvedDep
      if (visited.has(version.project_id)) {
        return []
      }
      visited.add(version.project_id)
      const deps = await Promise.all(version.dependencies.map(async (dep) => {
        const project = await swrvGet(getModrinthProjectKey(dep.project_id), () => clientModrinthV2.getProject(dep.project_id), config.cache, config.dedupingInterval)
        const versions = await swrvGet(getModrinthVersionKey(dep.project_id, undefined, version.loaders, version.game_versions),
            () => clientModrinthV2.getProjectVersions(dep.project_id, { loaders: version.loaders, gameVersions: version.game_versions }),
            config.cache, config.dedupingInterval)
        if (dep.version_id) {
          const id = dep.version_id
          const recommendedVersion = versions.find(v => v.id === id)!
          const result = await visit({ project, versions, recommendedVersion, type: dep.dependency_type })
          return result
        } else {
          const result = await visit({ project, versions, recommendedVersion: versions[0], type: dep.dependency_type })
          return result
        }
      }))

      return [resolvedDep, ...deps.reduce((a, b) => [...a, ...b], [])]
    }

    const tuples = await visit({ recommendedVersion: version } as any)
    tuples.shift()

    return tuples
  })
}
