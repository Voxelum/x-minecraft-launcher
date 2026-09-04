import type { ProjectVersion } from '@xmcl/modrinth'

export function includeModrinthUpgradeVersion(versions: ProjectVersion[] | undefined, upgradeVersion: ProjectVersion | undefined) {
  const result = versions ?? []
  if (!upgradeVersion || result.some(version => version.id === upgradeVersion.id)) {
    return result
  }
  return [upgradeVersion, ...result]
}