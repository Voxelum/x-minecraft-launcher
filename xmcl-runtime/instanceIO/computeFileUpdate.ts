import { File, InstanceFile, InstanceFileUpdate } from '@xmcl/runtime-api'
import { join } from 'path'
import { getFile } from '~/resource/core/files'

export async function computeFileUpdates(instancePath: string, oldFiles: InstanceFile[], newFiles: InstanceFile[], oldInstallTime: number | undefined, getSha1: (instancePath: string, file: File) => Promise<string>, getCrc32: (instancePath: string, file: File) => Promise<number>) {
  const toAdd: Record<string, InstanceFile> = {}
  const oldFilesMap: Record<string, InstanceFile> = {}

  for (const f of oldFiles) oldFilesMap[f.path] = f
  for (const f of newFiles) toAdd[f.path] = f

  const jointFilePaths = new Set([...oldFiles.map(f => f.path), ...newFiles.map(f => f.path)])

  const result: InstanceFileUpdate[] = []
  for (const p of jointFilePaths) {
    const filePath = join(instancePath, p)
    const file = await getFile(filePath)

    if (!file) {
      // not found
      if (toAdd[p]) {
        result.push({
          file: toAdd[p],
          operation: 'add'
        })
      }
    } else {
      let currentSha1 = ''
      let currentCrc32 = 0
      const isFileChanged = typeof oldInstallTime === 'number'
        ? oldInstallTime < file.mtime
        : oldFilesMap[p]?.hashes.sha1
          ? oldFilesMap[p]?.hashes.sha1 !== (currentSha1 = await getSha1(instancePath, file))
          : oldFilesMap[p]?.hashes.crc32
            ? Number.parseInt(oldFilesMap[p]?.hashes.crc32) !== (currentCrc32 = await getCrc32(instancePath, file))
            : oldFilesMap[p]?.size
              ? oldFilesMap[p]?.size !== file.size
              : false

      if (isFileChanged) {
        // modified
        if (toAdd[p]) {
          result.push({
            file: toAdd[p],
            operation: 'backup-add'
          })
        } else {
          result.push({
            file: oldFilesMap[p],
            operation: 'backup-remove'
          })
        }
      } else {
        // The file isn't modified from last install
        if (toAdd[p]) {
          const toAddFile = toAdd[p]

          const isFileDiff = async () => {
            if ('sha1' in toAddFile.hashes) {
              return (currentSha1 || await getSha1(instancePath, file)) !== toAdd[p].hashes.sha1
            }
            const crcDiff = 'crc32' in toAddFile.hashes ? (currentCrc32 || (currentCrc32 = await getCrc32(instancePath, file))) !== Number.parseInt(toAdd[p].hashes.crc32) : undefined
            const sizeDiff = 'size' in toAddFile ? file.size !== toAdd[p].size : undefined
            if (crcDiff || sizeDiff) {
              return true
            }
            if (crcDiff === undefined && sizeDiff === undefined) {
              // no clue
              return true
            }
            return false
          }

          const isFileDifferent = await isFileDiff()
          result.push({
            file: toAdd[p],
            operation: isFileDifferent ? 'add' : 'keep'
          })
        } else {
          result.push({
            file: oldFilesMap[p],
            operation: 'remove'
          })
        }
      }
    }
  }

  return result
}