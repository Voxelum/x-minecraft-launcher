import { readdir, stat, type Stats } from 'fs-extra'
import { join, relative } from 'path'
import { InstanceFile } from './files'
import type { ChecksumWorker, Logger, ResourceManager } from './internal_type'

/**
 * Resource metadata interface
 */
export interface ResourceLike {
  sha1: string
  ino?: number
  modrinth?: {
    projectId: string
    versionId: string
  }
  curseforge?: {
    projectId: number
    fileId: number
  }
}

/**
 * Filter function for file discovery
 */
export type FileFilter = (relativePath: string, stats: Stats) => boolean

/**
 * Discover all files in an instance directory
 * @returns The instance file with file stats array. The InstanceFile does not have hashes and downloads.
 */
export async function getInstanceFiles(
  instancePath: string,
  logger?: Logger,
  filter?: FileFilter,
): Promise<Array<[InstanceFile, Stats]>> {
  const files: Array<[InstanceFile, Stats]> = []

  const scan = async (dirOrFile: string) => {
    let stats: Stats
    try {
      stats = await stat(dirOrFile)
    } catch (error: any) {
      if (error.code === 'ENOENT') return
      throw error
    }

    const relativePath = relative(instancePath, dirOrFile).replace(/\\/g, '/')

    if (filter && filter(relativePath, stats)) {
      return
    }

    const isDirectory = stats.isDirectory()
    if (isDirectory) {
      const children = await readdir(dirOrFile)
      await Promise.all(
        children.map((child) =>
          scan(join(dirOrFile, child)).catch((e) => {
            logger?.warn(new Error('Fail to get manifest data for instance file', { cause: e }))
          }),
        ),
      )
    } else {
      const localFile: InstanceFile = {
        path: relativePath,
        size: stats.size,
        hashes: {},
      }
      files.push([localFile, stats])
    }
  }

  await scan(instancePath)
  return files
}

/**
 * Check if file is a special file that needs metadata decoration
 */
export const isSpecialFile = (relativePath: string): boolean =>
  (relativePath.startsWith('resourcepacks') ||
    relativePath.startsWith('shaderpacks') ||
    relativePath.startsWith('mods')) &&
  !relativePath.endsWith('.txt')

/**
 * Resolve hashes for a file
 */
async function resolveHashes(
  file: string,
  worker: ChecksumWorker,
  hashes?: string[],
  sha1?: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  if (hashes) {
    for (const hash of hashes) {
      if (hash === 'sha1') {
        if (sha1) {
          result.sha1 = sha1
        } else {
          result[hash] = await worker.checksum(file, hash)
        }
      } else {
        result[hash] = await worker.checksum(file, hash)
      }
    }
  }
  return result
}

/**
 * Decorate instance files with metadata from resource manager
 */
export async function decorateInstanceFiles(
  files: [InstanceFile, Stats][],
  instancePath: string,
  worker: ChecksumWorker,
  resourceManager: ResourceManager,
  undecoratedResources: Set<InstanceFile>,
  hashes?: string[],
): Promise<void> {
  // Get SHA1 hashes from resource manager using inode numbers
  const sha1Lookup = await resourceManager
    .getSnapshotsByIno(
      files
        .filter(([localFile, stat]) => isSpecialFile(localFile.path))
        .map(([localFile, stat]) => stat.ino),
    )
    .then((snapshots) => Object.fromEntries(snapshots.map((s) => [s.ino, s.sha1])))

  // First pass: compute SHA1 for special files
  for (const [localFile, stat] of files) {
    const relativePath = localFile.path
    const filePath = join(instancePath, relativePath)
    const ino = stat.ino

    if (isSpecialFile(relativePath)) {
      const sha1 = sha1Lookup[ino] || (await worker.checksum(filePath, 'sha1'))
      localFile.hashes.sha1 = sha1
    }
  }

  // Get existing SHA1 hashes and lookup metadata
  const existingSha1 = files.map((f) => f[0].hashes.sha1).filter((sha1): sha1 is string => !!sha1)

  const metadataLookup = await resourceManager
    .getMetadataByHashes(existingSha1)
    .then((metadata) =>
      Object.fromEntries(metadata.filter((m): m is ResourceLike => !!m).map((m) => [m.sha1, m])),
    )

  const urisLookup = await resourceManager.getUrisByHash(existingSha1).then((uris) =>
    uris.reduce(
      (acc, cur) => {
        if (!acc[cur.sha1]) {
          acc[cur.sha1] = []
        }
        acc[cur.sha1].push(cur.uri)
        return acc
      },
      {} as Record<string, string[]>,
    ),
  )

  // Second pass: decorate files with metadata
  for (const [localFile, stat] of files) {
    const relativePath = localFile.path
    const filePath = join(instancePath, relativePath)

    if (isSpecialFile(relativePath)) {
      const sha1 = localFile.hashes.sha1
      const metadata = metadataLookup[sha1]

      if (metadata?.modrinth) {
        localFile.modrinth = {
          projectId: metadata.modrinth.projectId,
          versionId: metadata.modrinth.versionId,
        }
      }

      if (metadata?.curseforge) {
        localFile.curseforge = {
          projectId: metadata.curseforge.projectId,
          fileId: metadata.curseforge.fileId,
        }
      }

      const uris = urisLookup[sha1]
      localFile.downloads =
        uris && uris.some((u) => u.startsWith('http'))
          ? uris.filter((u) => u.startsWith('http'))
          : undefined

      localFile.hashes = {
        ...localFile.hashes,
        ...(await resolveHashes(filePath, worker, hashes, sha1)),
      }

      // Mark files without download URLs for resolution
      if ((!localFile.downloads || localFile.downloads.length === 0) && metadata) {
        undecoratedResources.add(localFile)
      }
    } else {
      localFile.hashes = {
        ...localFile.hashes,
        ...(await resolveHashes(filePath, worker, hashes)),
      }
    }
  }
}
