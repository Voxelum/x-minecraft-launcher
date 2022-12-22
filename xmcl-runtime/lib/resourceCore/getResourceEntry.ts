import { stat } from 'fs/promises'
import { ResourceContext, ResourceEntryCache, ResourceEntryPath } from './ResourceContext'

export async function getResourceEntry(path: string, context: ResourceContext, skipCache = false): Promise<ResourceEntryPath | ResourceEntryCache> {
  const status = await stat(path)
  if (!skipCache) {
    const cache = await context.inoSnapshot.get(status.ino.toString()).catch(() => undefined)
    if (cache) {
      return cache
    }
  }

  if (status.isDirectory()) {
    return {
      path,
      fileType: 'directory',
      sha1: '',
      size: status.size,
      mtime: status.mtimeMs,
      ctime: status.ctimeMs,
      ino: status.ino,
    }
  }
  const [sha1, fileType] = await context.hashAndFileType(path, status.size)
  if (!skipCache) {
    const cache = await context.sha1Snapshot.get(sha1).catch(() => undefined)
    if (cache) {
      return cache
    }
  }
  return {
    path,
    fileType,
    sha1,
    size: status.size,
    mtime: status.mtimeMs,
    ctime: status.ctimeMs,
    ino: status.ino,
  }
}
