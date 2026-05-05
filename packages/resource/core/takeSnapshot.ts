import { relative } from 'path'
import { File } from '../File'
import { ResourceContext } from '../ResourceContext'
import { ResourceSnapshotTable } from '../schema'

export function getDomainedPath(filePath: string, root: string) {
  return relative(root, filePath).replace(/\\/g, '/')
}

export async function takeSnapshot(
  file: File,
  context: ResourceContext,
  parse: boolean,
): Promise<ResourceSnapshotTable> {
  const domainedPath = getDomainedPath(file.path, context.root)
  const [sha1, type] = await context
    .hashAndFileType(file.path, file.size, file.isDirectory)
    .catch((e) => {
      Object.setPrototypeOf(e, Error.prototype)
      throw e
    })
  const record = {
    domainedPath,
    ino: file.ino,
    mtime: file.mtime,
    fileType: type,
    sha1,
  }

  if (parse) {
    // update existing snapshots
    context.db
      .selectFrom('snapshots')
      .where('domainedPath', '!=', domainedPath)
      .where('ino', '=', file.ino)
      .selectAll()
      .execute()
      .then(
        (all) => {
          context.db
            .insertInto('snapshots')
            .values(
              all.map((r) => ({
                domainedPath: r.domainedPath,
                mtime: file.mtime,
                ino: r.ino,
                fileType: type,
                sha1,
              })),
            )
            .onConflict((oc) => {
              return oc.column('domainedPath').doUpdateSet((eb) => ({
                mtime: eb.ref('mtime'),
                fileType: eb.ref('fileType'),
                sha1: eb.ref('sha1'),
              }))
            })
        },
        (e) => {
          context.onError(e)
        },
      )

    // insert new snapshot
    context.db
      .insertInto('snapshots')
      .values(record)
      .onConflict((oc) => {
        return oc.column('domainedPath').doUpdateSet({
          ino: record!.ino,
          mtime: record!.mtime,
          fileType: record!.fileType,
          sha1: record!.sha1,
        })
      })
      .execute()
      .catch((e) => {
        context.onError(e)
      })
  }

  return record
}

export function isSnapshotValid(file: File, snapshot?: ResourceSnapshotTable) {
  if (!snapshot) {
    return false
  }
  if (file.ino !== snapshot.ino) {
    return false
  }
  if (snapshot.mtime < file.mtime) {
    return false
  }
  return true
}
