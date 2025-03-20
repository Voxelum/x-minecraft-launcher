import { parseVersion, VersionRange } from '@xmcl/runtime-api'
import { parseSemanticVersion, parseVersionRange } from '@xmcl/semver'
import { ModDependencies, ModDependency } from './modDependencies'

export type Compatible = 'maybe' | boolean

export type CompatibleDetail = {
  modId: string

  optional?: boolean

  compatible: Compatible
  /**
   * Can be either semantic version or version range
   */
  requirements: string | string[]

  version: string
}

export function resolveCompatible(deps: Compatible[]) {
  const values = deps
  if (values.some(v => v === false)) {
    return false
  }
  if (values.some(v => v === 'maybe')) {
    return 'maybe'
  }
  return true
}

/**
 * Resolve the compatibility of a mod dependency.
 *
 * @param dep The dependency
 * @param version The version of the mod
 */
export function getModCompatiblity(dep: ModDependency, version: string): Compatible {
  const id = dep.modId
  let compatible: Compatible = 'maybe'
  if (!version) {
    // No such version
    return false
  }
  if (dep.versionRange) {
    // Resolve version range compability
    const versionRange = dep.versionRange
    const range = VersionRange.createFromVersionSpec(versionRange)
    const currentVersion = parseVersion(version)
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
    return compatible
  }
  if (dep.semanticVersion) {
    const verison = parseSemanticVersion(version)
    const ranges =
      dep.semanticVersion instanceof Array
        ? dep.semanticVersion.map(v => parseVersionRange(v))
        : parseVersionRange(dep.semanticVersion)
    const compatible = ranges instanceof Array
      ? ranges.some(r => r?.test(verison))
      : ranges?.test(verison)
    return compatible ?? false
  }

  return compatible
}

/**
 * Resolve the compatibility of a mod dependencies.
 *
 * @param dependencies All dependencies
 * @param runtime All current mod versions
 */
export function getModsCompatiblity(dependencies: ModDependencies, runtime: Record<string, string>, ignoreFabricLoader?: boolean): CompatibleDetail[] {
  const result: CompatibleDetail[] = []
  for (const v of dependencies) {
    const id = v.modId
    const version = runtime[id]
    if (!version) {
      // No such version
      result.push({
        modId: id,
        compatible: false,
        optional: v.optional,
        requirements: v.versionRange || v.semanticVersion || '[*]',
        version: '',
      })
    } else {
      result.push({
        modId: id,
        optional: v.optional,
        compatible: getModCompatiblity(v, version),
        requirements: v.versionRange || v.semanticVersion || '[*]',
        version,
      })
    }
  }
  return result
}

export function resolveDepsCompatible(com: CompatibleDetail[]): Compatible {
  return resolveCompatible(com.map(v => v.compatible))
}
