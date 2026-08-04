import type { File } from '@xmcl/curseforge'
import type { InstanceFile } from '@xmcl/instance'
import type { ProjectVersion } from '@xmcl/modrinth'
import { getInstanceFileFromCurseforgeFile, getInstanceFileFromModrinthVersion } from '@xmcl/runtime-api'

interface UpgradePlanBase {
  mod: {
    fileName: string
    hash: string
    size: number
    curseforge?: { projectId: number; fileId: number }
    modrinth?: { projectId: string; versionId: string }
  }
}

type UpgradeManifestPlan = UpgradePlanBase & ({ file: File } | { version: ProjectVersion })

export function buildModUpgradeManifest(
  plans: readonly UpgradeManifestPlan[],
  destinationPrefix: 'mods' | 'resourcepacks' | 'shaderpacks' = 'mods',
) {
  const oldFiles: InstanceFile[] = []
  const files: InstanceFile[] = []
  for (const plan of plans) {
    oldFiles.push({
      path: `${destinationPrefix}/${plan.mod.fileName}`,
      hashes: { sha1: plan.mod.hash },
      size: plan.mod.size || 0,
      ...(plan.mod.curseforge ? { curseforge: plan.mod.curseforge } : {}),
      ...(plan.mod.modrinth ? { modrinth: plan.mod.modrinth } : {}),
    })
    const newFile: InstanceFile = 'file' in plan
      ? getInstanceFileFromCurseforgeFile(plan.file, destinationPrefix)
      : getInstanceFileFromModrinthVersion(plan.version, destinationPrefix)
    files.push(newFile)
  }

  return { oldFiles, files }
}