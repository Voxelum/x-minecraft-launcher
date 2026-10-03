import type { InstanceFile } from '@xmcl/instance'
import type { Entry } from '@xmcl/yauzl'

/** Describe an overrides ZIP without treating it as a standalone modpack. */
export function getArchiveFiles(path: string, entries: Entry[]): InstanceFile[] {
  return entries.filter(entry => !entry.fileName.endsWith('/')).map(entry => ({
    path: entry.fileName,
    size: entry.uncompressedSize,
    hashes: { crc32: entry.crc32.toString() },
    downloads: [`zip:///${path}?entry=${encodeURIComponent(entry.fileName)}`],
  }))
}
