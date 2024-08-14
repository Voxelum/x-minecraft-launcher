import { stat } from 'fs-extra'
import { ResourceContext } from './ResourceContext'
import { ResourceEntryPath, ResourceSnapshotTable } from './schema'

export async function getResourceEntry(path: string, context: ResourceContext, skipCache = false): Promise<ResourceEntryPath | ResourceSnapshotTable> {
  const status = await stat(path, { bigint: false })
  if (!skipCache) {
    const cache = await context.db.selectFrom('snapshots').where('ino', '=', status.ino).selectAll().executeTakeFirst()
    if (cache) {
      return {
        path,
        fileType: cache.fileType,
        sha1: cache.sha1,
        size: Number(status.size),
        mtime: Number(status.mtimeMs),
        ctime: Number(status.ctimeMs),
        ino: Number(status.ino),
      }
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
