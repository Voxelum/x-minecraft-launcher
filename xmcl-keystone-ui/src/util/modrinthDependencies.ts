import { clientModrinthV2 } from '@/util/clients'
import { ProjectVersion } from '@xmcl/modrinth'
export async function resolveModrinthDependencies(version: ProjectVersion) {
  const visited = new Set<string>()
  type VersionTuple = [ProjectVersion, 'required' | 'optional' | 'incompatible' | 'embedded']

  const visit = async (tuple: VersionTuple): Promise<VersionTuple[]> => {
    const [version] = tuple
    if (visited.has(version.project_id)) {
      return []
    }
    visited.add(version.project_id)
    const deps = await Promise.all(version.dependencies.map(async (dep) => {
      if (dep.version_id) {
        const depVersion = await clientModrinthV2.getProjectVersion(dep.version_id)
        const result = await visit([depVersion, dep.dependency_type])
        return result
      } else {
        const versions = await clientModrinthV2.getProjectVersions(dep.project_id, { loaders: version.loaders, gameVersions: version.game_versions })
        const result = await visit([versions[0], dep.dependency_type])
        return result
      }
    }))

    return [tuple, ...deps.reduce((a, b) => [...a, ...b], [])]
  }

  const tuples = await visit([version, 'required'])
  tuples.shift()

  return tuples
}
