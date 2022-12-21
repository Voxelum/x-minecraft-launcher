import { parseVersion, VersionRange } from '@xmcl/runtime-api'

export function isRangeCompatible(range: string, version: string): 'maybe' | boolean {
  const versionRange = VersionRange.createFromVersionSpec(range)
  const currentVersion = parseVersion(version)
  if (versionRange && currentVersion) {
    return versionRange.containsVersion(currentVersion)
  }
  return 'maybe'
}
