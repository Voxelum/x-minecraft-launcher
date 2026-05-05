import { join } from 'path'
import { InstanceFile, InstanceFileUpdate } from './files'

/**
 * File system abstraction for checking files
 */
interface FileSystem {
  /**
   * Get file information
   */
  getFile(path: string): Promise<{ size: number; mtime: number } | undefined>
  /**
   * Compute SHA1 hash
   */
  getSha1(instancePath: string, file: { size: number; mtime: number }): Promise<string>
  /**
   * Compute CRC32 hash
   */
  getCrc32(instancePath: string, file: { size: number; mtime: number }): Promise<number>
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
): Promise<InstanceFileUpdate[]> {
  const toAdd: Record<string, InstanceFile> = {}
  const oldFilesMap: Record<string, InstanceFile> = {}

  for (const f of oldFiles) oldFilesMap[f.path] = f
  for (const f of newFiles) toAdd[f.path] = f

  const jointFilePaths = new Set([...oldFiles.map((f) => f.path), ...newFiles.map((f) => f.path)])

  const result: InstanceFileUpdate[] = []

  for (const p of jointFilePaths) {
    const filePath = join(instancePath, p)
    const file = await fs.getFile(filePath)

    if (!file) {
      // File not found on disk
      if (toAdd[p]) {
        result.push({
          file: toAdd[p],
          operation: 'add',
        })
      }
    } else {
      let currentSha1 = ''
      let currentCrc32 = 0

      // Check if file changed compared to old install
      const isFileChangedComparedToOldFile =
        typeof oldInstallTime === 'number'
          ? oldInstallTime < file.mtime
          : oldFilesMap[p]?.hashes.sha1
            ? oldFilesMap[p]?.hashes.sha1 !== (currentSha1 = await fs.getSha1(instancePath, file))
            : oldFilesMap[p]?.hashes.crc32
              ? Number.parseInt(oldFilesMap[p]?.hashes.crc32) !==
                (currentCrc32 = await fs.getCrc32(instancePath, file))
              : oldFilesMap[p]?.size
                ? oldFilesMap[p]?.size !== file.size
                : undefined

      if (isFileChangedComparedToOldFile) {
        // File was modified
        if (toAdd[p]) {
          result.push({
            file: toAdd[p],
            operation: 'backup-add',
          })
        } else {
          result.push({
            file: oldFilesMap[p],
            operation: 'backup-remove',
          })
        }
      } else {
        if (toAdd[p]) {
          const toAddFile = toAdd[p]

          const isFileDiff = async (): Promise<boolean> => {
            if ('sha1' in toAddFile.hashes) {
              return (
                (currentSha1 || (await fs.getSha1(instancePath, file))) !== toAdd[p].hashes.sha1
              )
            }
            const crcDiff =
              'crc32' in toAddFile.hashes
                ? (currentCrc32 || (currentCrc32 = await fs.getCrc32(instancePath, file))) !==
                  Number.parseInt(toAdd[p].hashes.crc32)
                : undefined
            const sizeDiff = 'size' in toAddFile ? file.size !== toAdd[p].size : undefined

            if (crcDiff || sizeDiff) {
              return true
            }
            if (crcDiff === undefined && sizeDiff === undefined) {
              // No way to determine difference
              return true
            }
            return false
          }

          const dontKnowOldFile = isFileChangedComparedToOldFile === undefined
          const isFileDifferent = await isFileDiff()

          result.push({
            file: toAdd[p],
            operation: !isFileDifferent ? 'keep' : dontKnowOldFile ? 'backup-add' : 'add',
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
