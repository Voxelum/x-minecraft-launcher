import { stat } from 'fs/promises'
import { ResourceContext } from './ResourceContext'
import { ResourceEntryPath, ResourceSnapshotTable } from './schema'

export async function getResourceEntry(path: string, context: ResourceContext, skipCache = false): Promise<ResourceEntryPath | ResourceSnapshotTable> {
  const status = await stat(path)
  if (!skipCache) {
    const cache = await context.db.selectFrom('snapshots').where('ino', '=', status.ino).selectAll().executeTakeFirst()
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
    const cache = await context.db.selectFrom('snapshots').where('sha1', '=', sha1).selectAll().executeTakeFirst()
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
