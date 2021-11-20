import { ForgeModMetadata } from '@xmcl/mod-parser';
import { coerce, satisfies } from 'semver';
import { Instance } from '../entities/instance';
import { FabricResource, ForgeResource, isFabricResource, isForgeResource, isLiteloaderResource, LiteloaderResource, ModResource } from '../entities/resource';
import { Resource, ResourceType } from '../entities/resource.schema';
import { parseVersion, VersionRange } from './mavenVersion';

export type Compatible = 'maybe' | boolean
export type DepsCompatible = Record<string, Compatible>

function resolveCompatible(deps: Compatible[]) {
  const values = deps
  if (values.some(v => v === false)) {
    return false
  }
  if (values.some(v => v === 'maybe')) {
    return 'maybe'
  }
  return true
}

export function isFabricModCompatible(resource: FabricResource, runtime: Instance['runtime']): Compatible {
  const result = getFabricModCompatibility(resource, runtime)
  console.log(result)
  return resolveCompatible(Object.values(result))
}

export function isForgeModCompatible(resource: ForgeResource, runtime: Instance['runtime']): Compatible {
  const result = getForgeModCompatibility(resource, runtime)
  return resolveCompatible(Object.values(result).map(v => resolveCompatible(Object.values(v))))
}

export function getFabricModCompatibility(resource: FabricResource, runtime: Instance['runtime']) {
  const versions: Record<string, string | undefined> = { minecraft: runtime.minecraft, fabricloader: runtime.fabricLoader }
  const compatibility: DepsCompatible = {}
  if (resource.metadata.depends) {
    for (const [id, version] of Object.entries(resource.metadata.depends)) {
      let compatible: Compatible = 'maybe'
      const current = versions[id]
      if (current) {
        if (typeof version === 'string') {
          compatible = satisfies(runtime.minecraft, version)
        } else if (version) {
          for (const mc of version) {
            if (satisfies(runtime.minecraft, mc)) {
              compatible = true
              break
            }
          }
        }
      } else {
        // just ignore for now
        continue
      }
      compatibility[id] = compatible
    }
  }
  return compatibility
}

function parseForgeDependenciesString(dep: string) {
  return dep.split(';')
    .map(d => d.split(':'))
    .filter(d => d[0].startsWith('required'))
    .map(d => d[1].split('@'))
    .map(v => ({ modId: v[0] === 'Forge' ? 'forge': v[0], versionRange: v[1] ?? '' }))
}

export type ForgeCommonDependencies = Array<{ modId: string; versionRange: string; semanticVersion?: string }>

export function getLegacyForgeDependencies(mod: ForgeModMetadata) {
  const result: Record<string, ForgeCommonDependencies> = {}
  // for legacy mods, we respect annotation more
  for (const anno of mod.modAnnotations) {
    const allDeps: ForgeCommonDependencies = []
    if (anno.dependencies) {
      allDeps.push(...parseForgeDependenciesString(anno.dependencies))
    }
    if (anno.acceptedMinecraftVersions) {
      allDeps.push({ modId: 'minecraft', versionRange: anno.acceptedMinecraftVersions })
    } else {
      const mcmodInfo = mod.mcmodInfo.find(m => m.modid === anno.modid)
      if (mcmodInfo && mcmodInfo.mcversion) {
        allDeps.push({ modId: 'minecraft', versionRange: '', semanticVersion: `~${mcmodInfo.mcversion}` })
      }
    }
    result[anno.modid] = allDeps
  }
  return result
}

export function getForgeModCompatibility(resource: ForgeResource, runtime: Instance['runtime']) {
  const deps: Record<string, ForgeCommonDependencies> = {}
  if (resource.metadata.modsToml.length > 0) {
    // new mod
    for (const mod of resource.metadata.modsToml) {
      deps[mod.modid] = mod.dependencies
      deps[mod.modid].push({ modId: 'forge', versionRange: mod.loaderVersion })
    }
  } else {
    // legacy mod
    for (const [modid, dependencies] of Object.entries(getLegacyForgeDependencies(resource.metadata))) {
      deps[modid] = dependencies
    }
  }

  const versions: Record<string, string | undefined> = { minecraft: runtime.minecraft, forge: runtime.forge }

  const result: Record<string, DepsCompatible> = {}
  for (const [modid, dependencies] of Object.entries(deps)) {
    const compatibility: DepsCompatible = {}
    for (const dep of dependencies) {
      let compatible: Compatible = 'maybe'
      const current = versions[dep.modId]
      if (!current) {
        compatible = false
      } else {
        const range = VersionRange.createFromVersionSpec(dep.versionRange)
        const currentVersion = parseVersion(current)
        if (range) {
          compatible = range.containsVersion(currentVersion)
        }
      }
      compatibility[dep.modId] = compatible
    }
    result[modid] = compatibility
  }
  console.log(resource.name)
  console.log(result)
  return result
}

export function isLiteloaderModCompatibility(resource: LiteloaderResource, runtime: Instance['runtime']): Compatible {
  const sem = `~${resource.metadata.mcversion}`
  if (runtime.liteloader) {
    return satisfies(runtime.liteloader, sem)
  } 
  return 'maybe'
}

export function isCompatible(resource: Resource, runtime: Instance['runtime']): Compatible {
  if (isForgeResource(resource)) {
    if (!runtime.forge) return false
    return isForgeModCompatible(resource, runtime)
  } else if (isFabricResource(resource)) {
    if (!runtime.fabricLoader) return false
    return isFabricModCompatible(resource, runtime)
  } else if (isLiteloaderResource(resource)) {
    if (!runtime.liteloader) return false
    return isLiteloaderModCompatibility(resource, runtime)
  }
  return 'maybe'
}