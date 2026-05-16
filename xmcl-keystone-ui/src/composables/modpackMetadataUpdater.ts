import { ProjectFile } from '@/util/search'
import { InstanceModpackMetadataSchema } from '@xmcl/runtime-api'

/**
 * Update emittedFiles in modpack-metadata.json after installing/uninstalling files.
 * Replaces old file paths with new ones so the export selection stays in sync.
 *
 * This is fire-and-forget — errors are silently ignored since it's non-critical.
 */
export function updateEmittedFiles(
  instancePath: string,
  oldFiles: ProjectFile[],
  newInstalledPaths: string[],
  getMetadata: (path: string) => Promise<InstanceModpackMetadataSchema | undefined>,
  setMetadata: (path: string, metadata: InstanceModpackMetadataSchema | undefined) => Promise<void>,
) {
  // Normalize separators for cross-platform path comparison
  const normalize = (p: string) => p.replace(/\\/g, '/')
  const normalizedInstance = normalize(instancePath)
  const prefix = normalizedInstance.endsWith('/') ? normalizedInstance : normalizedInstance + '/'

  const toRelative = (abs: string) => {
    const normalized = normalize(abs)
    return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized
  }

  getMetadata(instancePath).then((metadata) => {
    if (!metadata || !metadata.emittedFiles || metadata.emittedFiles.length === 0) return

    const removedPaths = new Set(oldFiles.map((f) => toRelative(f.path)))
    const addedPaths = newInstalledPaths.map(toRelative)

    const updated = metadata.emittedFiles.filter((p) => !removedPaths.has(p))
    for (const p of addedPaths) {
      if (!updated.includes(p)) {
        updated.push(p)
      }
    }

    if (updated.length !== metadata.emittedFiles.length ||
      updated.some((p, i) => p !== metadata.emittedFiles[i])) {
      metadata.emittedFiles = updated
      setMetadata(instancePath, metadata)
    }
  }).catch(() => {
    // Non-critical
  })
}
