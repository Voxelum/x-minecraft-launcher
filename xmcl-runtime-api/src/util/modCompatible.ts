import { ForgeModMetadata } from '@xmcl/mod-parser'
import { satisfies } from 'semver'
import { FabricResource, ForgeResource, isFabricResource, isForgeResource, isLiteloaderResource, LiteloaderResource, Resource } from '../entities/resource'
import { parseVersion, VersionRange } from './mavenVersion'

export type Compatible = 'maybe' | boolean
export type DepsCompatible = Record<string, CompatibleDetail>

export type CompatibleDetail = {
  compatible: Compatible
  /**
   * Can be either semantic version or version range
   */
  requirements: string | string[]

  version: string
}

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

export function isFabricModCompatible(resource: FabricResource, runtime: Record<string, string>): Compatible {
  const result = getFabricModCompatibility(resource, runtime)
  return resolveCompatible(Object.values(result).map(v => v.compatible))
}

export function isForgeModCompatible(resource: ForgeResource, runtime: Record<string, string>): Compatible {
  const result = getForgeModCompatibility(resource, runtime)
  return resolveCompatible(Object.values(result)
    .map(v => resolveCompatible(Object.entries(v)
      .filter(([k]) => k === 'minecraft' || k === 'forge')
      .map(x => x[1].compatible))))
}

function normalizeMinecraftVersion(v: string) {
  return v.split('.').length === 2 ? v + '.0' : v
}

export function getFabricModCompatibility(resource: FabricResource, runtime: Record<string, string>): DepsCompatible {
  const versions: Record<string, string | undefined> = { ...runtime }
  const compatibility: DepsCompatible = {}
  const deps = resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0].depends : resource.metadata.fabric.depends
  if (deps) {
    for (const [id, requirements] of Object.entries(deps)) {
      let compatible: Compatible = 'maybe'
      const current = versions[id]
      if (current) {
        if (typeof requirements === 'string') {
          compatible = satisfies(current, requirements)
          if (!compatible && id === 'minecraft' && runtime.minecraft.split('.').length === 2) {
            compatible = satisfies(runtime.minecraft + '.0', requirements)
          }
        } else if (requirements) {
          for (const v of requirements) {
            if (satisfies(current, v)) {
              compatible = true
              break
            }
          }
        }
      } else {
        compatible = false
      }
      compatibility[id] = {
        compatible,
        requirements: requirements,
        version: current || '',
      }
    }
  }

  return compatibility
}

function parseForgeDependenciesString(dep: string) {
  return dep.split(';')
    .map(d => d.split(':'))
    .filter(d => d[0].startsWith('required'))
    .map(d => d[1].split('@'))
    .map(v => ({ modId: v[0] === 'Forge' ? 'forge' : v[0], versionRange: v[1] ?? '' }))
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

export function getForgeModCompatibility(resource: ForgeResource, runtime: Record<string, string>) {
  const deps: Record<string, ForgeCommonDependencies> = {}
  if (resource.metadata.forge.modsToml.length > 0) {
    // new mod
    for (const mod of resource.metadata.forge.modsToml) {
      deps[mod.modid] = mod.dependencies
      deps[mod.modid].push({ modId: 'forge', versionRange: mod.loaderVersion })
    }
  } else {
    // legacy mod
    for (const [modid, dependencies] of Object.entries(getLegacyForgeDependencies(resource.metadata.forge))) {
      deps[modid] = dependencies
    }
  }

  const versions: Record<string, string | undefined> = { ...runtime }

  const result: Record<string, DepsCompatible> = {}
  for (const [modid, dependencies] of Object.entries(deps)) {
    const compatibility: DepsCompatible = {}
    for (const dep of dependencies) {
      let compatible: Compatible = 'maybe'
      const current = versions[dep.modId]
      if (!current) {
        compatible = false
      } else if (dep.versionRange) {
        const range = VersionRange.createFromVersionSpec(dep.versionRange)
        const currentVersion = parseVersion(current)
        if (range) {
          compatible = range.containsVersion(currentVersion)
          if (!compatible) {
            const res = range.restrictions[0]
            if (Math.abs(res.lowerBound?.compareTo(currentVersion) ?? 100) === 1 ||
              Math.abs(res.upperBound?.compareTo(currentVersion) ?? 100) === 1) {
              compatible = 'maybe'
            }
          }
        }
      } else if (dep.semanticVersion) {
        compatible = satisfies(current, dep.semanticVersion)
      }
      compatibility[dep.modId] = {
        compatible,
        requirements: dep.versionRange || dep.semanticVersion || '',
        version: current ?? '',
      }
    }

    if (!compatibility.forge) {
      compatibility.forge = {
        compatible: !!runtime.forge,
        requirements: '[*]',
        version: runtime.forge || '',
      }
    }

    result[modid] = compatibility
  }

  return result
}

export function getLiteloaderModCompatibility(resource: LiteloaderResource, runtime: Record<string, string>) {
  const deps: DepsCompatible = {}
  const sem = `~${resource.metadata.liteloader.mcversion}`
  deps.minecraft = {
    compatible: satisfies(normalizeMinecraftVersion(runtime.minecraft), sem),
    requirements: resource.metadata.liteloader.mcversion,
    version: runtime.minecraft,
  }
  deps.liteloader = {
    compatible: !!runtime.liteloader,
    requirements: '',
    version: runtime.liteloader || '',
  }
  return deps
}

export function getModCompatibility(resource: Resource, runtime: Record<string, string>): DepsCompatible {
  if (isForgeResource(resource)) {
    const forge = getForgeModCompatibility(resource, runtime)
    const deps: DepsCompatible = {}
    for (const dep of Object.values(forge)) {
      for (const [key, val] of Object.entries(dep)) {
        if (deps[key]) {
          if (deps[key].compatible === true && deps[key].compatible !== true) {
            deps[key] = val
          }
        } else {
          deps[key] = val
        }
      }
    }
    return deps
  }

  if (isFabricResource(resource)) {
    return getFabricModCompatibility(resource, runtime)
  }
  if (isLiteloaderResource(resource)) {
    return getLiteloaderModCompatibility(resource, runtime)
  }
  return {}
}

export function isModCompatible(resource: Resource, runtime: Record<string, string>): Compatible {
  if (isForgeResource(resource)) {
    if (!runtime.forge) return false
    return isForgeModCompatible(resource, runtime)
  } else if (isFabricResource(resource)) {
    if (!runtime.fabricLoader) return false
    return isFabricModCompatible(resource, runtime)
  } else if (isLiteloaderResource(resource)) {
    const result = getLiteloaderModCompatibility(resource, runtime)
    return resolveCompatible(Object.values(result).map(v => v.compatible))
  }
  return 'maybe'
}

export function resolveDepsCompatible(com: DepsCompatible): Compatible {
  return resolveCompatible(Object.values(com).map(v => v.compatible))
}

export function isRangeCompatible(range: string, version: string): Compatible {
  const versionRange = VersionRange.createFromVersionSpec(range)
  const currentVersion = parseVersion(version)
  if (versionRange && currentVersion) {
    return versionRange.containsVersion(currentVersion)
  }
  return 'maybe'
}
