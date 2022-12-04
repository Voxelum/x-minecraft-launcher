import { parseVersion, VersionRange } from '@xmcl/runtime-api'
import { satisfies } from 'semver'
import { ModDependencies } from './modDependencies'

export type Compatible = 'maybe' | boolean

export type CompatibleDetail = {
  modId: string

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

export function getModCompatiblity(dependencies: ModDependencies, runtime: Record<string, string>): CompatibleDetail[] {
  const result: CompatibleDetail[] = []
  for (const v of dependencies) {
    const id = v.modId
    const current = runtime[id]
    let compatible: Compatible = 'maybe'
    if (!current) {
      // No such version
      result.push({
        modId: id,
        compatible: false,
        requirements: v.versionRange || v.semanticVersion || '[*]',
        version: '',
      })
    } else if (v.versionRange) {
      // Resolve version range compability
      const versionRange = v.versionRange
      const range = VersionRange.createFromVersionSpec(versionRange)
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
      result.push({
        modId: id,
        compatible,
        requirements: versionRange,
        version: current,
      })
    } else if (v.semanticVersion) {
      // Resolve semanticVersion compability
      const requirements = v.semanticVersion
      let compatible: Compatible = 'maybe'
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
      result.push({
        modId: id,
        compatible,
        requirements: requirements,
        version: current,
      })
    }
  }
  return result
}

export function resolveDepsCompatible(com: CompatibleDetail[]): Compatible {
  return resolveCompatible(com.map(v => v.compatible))
}
