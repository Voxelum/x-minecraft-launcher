import type { InstanceFile } from '@xmcl/instance'
import type { ModFile } from '@/util/mod'

export type ModDependencyInstallation = [InstanceFile, ModFile]

/**
 * Identify a dependency by its project, not by its downloaded filename.
 * Different versions of the same project usually have different filenames,
 * so using the path here would allow two versions into one install plan.
 */
export function getModDependencyIdentity(file: InstanceFile): string {
  if (file.modrinth) return `modrinth:${file.modrinth.projectId}`
  if (file.curseforge) return `curseforge:${file.curseforge.projectId}`
  return `path:${file.path.replace(/\.disabled$/, '').toLocaleLowerCase()}`
}

/**
 * Keep one candidate per dependency project. The dependency checkers already
 * choose the best candidate for each provider; this is a final safety net for
 * duplicates introduced while combining provider results or by a repeated
 * agent action.
 */
export function deduplicateModDependencyInstallations(
  installations: ModDependencyInstallation[],
): ModDependencyInstallation[] {
  const unique = new Map<string, ModDependencyInstallation>()
  for (const installation of installations) {
    const identity = getModDependencyIdentity(installation[0])
    if (!unique.has(identity)) unique.set(identity, installation)
  }
  return [...unique.values()]
}
