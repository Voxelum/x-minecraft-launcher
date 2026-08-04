import { FileRelationType } from '@xmcl/curseforge'
import type { InstanceFile } from '@xmcl/instance'
import { readFabricMod, readForgeModToml, readQuiltMod } from '@xmcl/mod-parser'

type ArtifactLoader = 'forge' | 'neoforge' | 'fabric' | 'quilt'

interface InstalledModFile {
  fileName: string
  hash: string
  size: number
  curseforge?: { projectId: number }
  modrinth?: { projectId: string }
}

export function getReplacedModFiles(files: InstanceFile[], installedMods: InstalledModFile[]): InstanceFile[] {
  const modrinthProjects = new Set(files.flatMap(file => file.modrinth ? [file.modrinth.projectId] : []))
  const curseforgeProjects = new Set(files.flatMap(file => file.curseforge ? [file.curseforge.projectId] : []))
  const replaced = installedMods.filter(mod =>
    (mod.modrinth && modrinthProjects.has(mod.modrinth.projectId)) ||
    (mod.curseforge && curseforgeProjects.has(mod.curseforge.projectId)),
  )
  return [...new Map(replaced.map((mod) => {
    const hashes: Record<string, string> = {}
    if (mod.hash) hashes.sha1 = mod.hash
    return [mod.fileName, {
      path: `mods/${mod.fileName}`,
      hashes,
      size: mod.size,
    }] as const
  })).values()]
}

export function getRequiredForgeModIds(metadata: Array<{
  dependencies: Array<{ modId: string; mandatory?: boolean; type?: string }>
}>) {
  return metadata.flatMap(mod => mod.dependencies
    .filter(dependency => dependency.type ? dependency.type === 'required' : dependency.mandatory)
    .map(dependency => dependency.modId))
}

export async function getRequiredModIdsFromArtifact(content: Uint8Array, loader: ArtifactLoader) {
  if (loader === 'fabric') {
    const metadata = await readFabricMod(content)
    return Object.keys(metadata.depends ?? {})
  }
  if (loader === 'quilt') {
    const metadata = await readQuiltMod(content)
    return (metadata.quilt_loader.depends ?? [])
      .filter(dependency => !dependency.optional)
      .map(dependency => dependency.id)
  }

  const fileName = loader === 'neoforge' ? 'neoforge.mods.toml' : 'mods.toml'
  const metadata = await readForgeModToml(content, undefined, fileName)
  return getRequiredForgeModIds(metadata)
}

export function getRequiredModrinthInstallVersions(
  root: { id: string; icon?: string },
  dependencies: Array<{
    type: string
    project: { id: string; icon_url?: string }
    recommendedVersion: { id: string }
  }>,
  installedProjects: ReadonlySet<string>,
) {
  const versions = dependencies
    .filter(dependency => dependency.type === 'required' && !installedProjects.has(dependency.project.id))
    .map(dependency => [dependency.project.id, {
      versionId: dependency.recommendedVersion.id,
      icon: dependency.project.icon_url,
    }] as const)
  return [...new Map(versions).values(), { versionId: root.id, icon: root.icon }]
}

export function getRequiredCurseforgeInstallFiles(
  root: { id: number; icon?: string },
  dependencies: Array<{
    type: FileRelationType
    project: { id: number; logo?: { url?: string } }
    file: { id: number }
  }>,
  installedProjects: ReadonlySet<number>,
) {
  const files = dependencies
    .filter(dependency => dependency.type === FileRelationType.RequiredDependency && !installedProjects.has(dependency.project.id))
    .map(dependency => [dependency.project.id, {
      fileId: dependency.file.id,
      icon: dependency.project.logo?.url,
    }] as const)
  return [...new Map(files).values(), { fileId: root.id, icon: root.icon }]
}