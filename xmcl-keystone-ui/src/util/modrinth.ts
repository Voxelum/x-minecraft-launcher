import { clientModrinthV2 } from '@/util/clients'
import { ProjectVersion } from '@xmcl/modrinth'
import { InstanceFile, RuntimeVersions } from '@xmcl/runtime-api'
import { isNoModLoader } from './isNoModloader'
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

export function getModrinthModLoaders(runtime: RuntimeVersions, allForNoModLoader = true) {
  const noModLoader = isNoModLoader(runtime)
  const modLoaders = [] as string[]
  if (noModLoader && allForNoModLoader) {
    modLoaders.push('forge', 'fabric', 'quilt', 'liteloader', 'neoforge')
  } else {
    if (runtime.forge) {
      modLoaders.push('forge')
    }
    if (runtime.fabricLoader) {
      modLoaders.push('fabric')
    }
    if (runtime.quiltLoader) {
      modLoaders.push('quilt')
    }
    if (runtime.liteLoader) {
      modLoaders.push('liteloader')
    }
    if (runtime.neoForged) {
      modLoaders.push('neoforge')
    }
  }

  return modLoaders
}

export function getModrinthVersionKey(projectId: string, featured?: boolean, loaders?: string[] | undefined, gameVersions?: string[]) {
  return `/modrinth/versions/${projectId}?featured=${featured}&loaders=${loaders?.join(',') || ''}&gameVersions=${gameVersions?.join(',') || ''}`
}

export function getModrinthProjectKey(projectId: string) {
  return `/modrinth/${projectId}`
}

export function getInstanceFileFromModrinthVersion(version: ProjectVersion): InstanceFile {
  const primary = version.files.find(f => f.primary) || version.files[0]
  return {
    path: `mods/${(primary.filename)}`,
    hashes: primary.hashes,
    size: 0,
    modrinth: {
      projectId: version.project_id,
      versionId: version.id,
    },
  }
}
