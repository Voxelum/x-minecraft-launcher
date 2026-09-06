import { join } from 'path'
import { InstanceFile, InstanceFileUpdate } from './files'
import {
  getInstanceFileChecksum,
  instanceFileChecksumAlgorithms,
  normalizeInstanceFileChecksum,
  type InstanceFileChecksumAlgorithm,
} from './files_integrity'

/**
 * File system abstraction for checking files
 */
interface FileInfo {
  size: number
  mtime: number
}

interface FileSystem {
  /**
   * Get file information
   */
  getFile(path: string): Promise<FileInfo | undefined>
  /**
   * Compute SHA1 hash
   */
  getSha1(instancePath: string, file: FileInfo): Promise<string>
  /**
   * Compute CRC32 hash
   */
  getCrc32(instancePath: string, file: FileInfo): Promise<number>
  /**
   * Compute any supported checksum
   */
  getChecksum?(
    instancePath: string,
    file: FileInfo,
    algorithm: InstanceFileChecksumAlgorithm,
  ): Promise<string | number>
}

/**
 * Compute file updates between old and new file lists
 */
export async function computeFileUpdates(
  instancePath: string,
  oldFiles: InstanceFile[],
  newFiles: InstanceFile[],
  oldInstallTime: number | undefined,
  fs: FileSystem,
  caseInsensitive = process.platform === 'win32',
): Promise<InstanceFileUpdate[]> {
  const supportedAlgorithms = fs.getChecksum
    ? instanceFileChecksumAlgorithms
    : ['sha1', 'crc32'] as const
  const toAdd: Record<string, InstanceFile> = {}
  const oldFilesMap: Record<string, InstanceFile> = {}
  const oldPathsByKey = new Map<string, string>()

  for (const f of oldFiles) {
    oldFilesMap[f.path] = f
    oldPathsByKey.set(caseInsensitive ? f.path.toLowerCase() : f.path, f.path)
  }
  for (const f of newFiles) toAdd[f.path] = f

  const jointFilePaths = new Set([...oldFiles.map((f) => f.path), ...newFiles.map((f) => f.path)])

  const result: InstanceFileUpdate[] = []

  for (const p of jointFilePaths) {
    const filePath = join(instancePath, p)
    const file = await fs.getFile(filePath)
    const oldPath = oldPathsByKey.get(caseInsensitive ? p.toLowerCase() : p)
    const isCaseOnlyRename = !!toAdd[p] && !!oldPath && oldPath !== p

    if (!file) {
      // File not found on disk
      if (toAdd[p]) {
        result.push({
          file: toAdd[p],
          operation: 'add',
        })
      }
    } else {
      const currentChecksums = new Map<InstanceFileChecksumAlgorithm, string>()

      const getCurrentChecksum = async (algorithm: InstanceFileChecksumAlgorithm) => {
        const cached = currentChecksums.get(algorithm)
        if (cached !== undefined) return cached

        const value = normalizeInstanceFileChecksum(
          algorithm,
          fs.getChecksum
            ? await fs.getChecksum(instancePath, file, algorithm)
            : algorithm === 'sha1'
              ? await fs.getSha1(instancePath, file)
              : await fs.getCrc32(instancePath, file),
        ) ?? ''
        currentChecksums.set(algorithm, value)
        return value
      }

      const isFileDifferentFromManifest = async (target: InstanceFile) => {
        const checksum = getInstanceFileChecksum(target)
        if (checksum) {
          if (!supportedAlgorithms.some(algorithm => algorithm === checksum.algorithm)) return undefined
          return (await getCurrentChecksum(checksum.algorithm)) !== checksum.value
        }
        if (typeof target.size === 'number') {
          return file.size !== target.size
        }
        return undefined
      }

      // Check if file changed compared to old install
      const isFileChangedComparedToOldFile =
        typeof oldInstallTime === 'number'
          ? oldInstallTime < file.mtime
          : oldFilesMap[p]
            ? await isFileDifferentFromManifest(oldFilesMap[p])
            : undefined

      // Compare the on-disk file against the desired new file. Used both
      // when the file is unchanged from the last install (cheap update
      // check) AND when the user touched it (so we can avoid an
      // unnecessary backup if their content already matches the new
      // modpack version).
      const isFileDiffFromNew = async (toAddFile: InstanceFile): Promise<boolean> => {
        const checksumDiff = await isFileDifferentFromManifest(toAddFile)
        if (checksumDiff !== undefined) {
          return checksumDiff
        }
        // No supported way to determine difference
        return true
      }

      if (isFileChangedComparedToOldFile) {
        // File was modified by the user since the last install
        if (toAdd[p]) {
          // The file is also in the new manifest. If the user's
          // current content already matches the new desired content,
          // there's nothing to do — and we should NOT create a backup
          // of an identical file.
          const isDifferent = await isFileDiffFromNew(toAdd[p])
          result.push({
            file: toAdd[p],
            operation: isCaseOnlyRename ? 'add' : isDifferent ? 'backup-add' : 'keep',
          })
        } else {
          result.push({
            file: oldFilesMap[p],
            operation: 'backup-remove',
          })
        }
      } else {
        if (toAdd[p]) {
          const dontKnowOldFile = isFileChangedComparedToOldFile === undefined
          const isFileDifferent = await isFileDiffFromNew(toAdd[p])

          result.push({
            file: toAdd[p],
            operation: isCaseOnlyRename ? 'add' : !isFileDifferent ? 'keep' : dontKnowOldFile ? 'backup-add' : 'add',
          })
        } else {
          result.push({
            file: oldFilesMap[p],
            operation: 'remove',
          })
        }
      }
    }
  }

  return result
}
