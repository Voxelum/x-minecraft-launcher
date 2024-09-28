import { ResourceDomain } from '@xmcl/runtime-api'
import { randomBytes } from 'crypto'
import filenamify from 'filenamify'
import { rename, stat, unlink } from 'fs-extra'
import { dirname, extname, join } from 'path'
import { linkOrCopy } from '~/util/fs'
import { getResourceEntry } from './getResourceEntry'
import { ResourceContext } from './ResourceContext'
import { isSystemError } from '~/util/error'

export async function tryPersistResource(resource: { fileName: string; domain: ResourceDomain; hash: string; path: string }, root: string, context: ResourceContext): Promise<[string, boolean]> {
  const backup = [
    filenamify(`${resource.fileName}.${resource.hash.slice(0, 6)}${extname(resource.fileName)}`, { replacement: '-' }),
    filenamify(`${resource.fileName}.${resource.hash}${extname(resource.fileName)}`, { replacement: '-' }),
  ]
  let fileName = filenamify(resource.fileName, { replacement: '-' })
  if (fileName.endsWith('.disabled')) {
    fileName = fileName.slice(0, -9)
  }
  let filePath = join(root, resource.domain, fileName)

  const entryName = `${resource.domain}/${fileName}`
  let existedEntry = await context.db.selectFrom('snapshots')
    .where('domainedPath', '=', entryName)
    .selectAll()
    .executeTakeFirst()
  while (existedEntry) {
    // Some file have the same path. Now we more trust the real file system
    // So we try to merge data in current database

    const sha1 = existedEntry.sha1

    if (sha1 === resource.hash) {
      // The file is already imported...
      // We just don't copy/link the file again
      return [filePath, true]
    }

    // Two different file, but different content
    const candidate = backup.shift()
    if (!candidate) {
      // Same sha1 file name but the file's sha1 does not match the metadata!
      // The metadata is broken and we need to revaldiate the resource
      const localEntry = await getResourceEntry(filePath, context, true)
      const newFilename = filenamify(`${resource.fileName}.${localEntry.sha1}${extname(resource.fileName)}`, { replacement: '-' })
      if (newFilename !== fileName) {
        // Rename to force validate the resource
        await rename(filePath, newFilename)
      } else {
        // Use random string for new resource to prevent conflict
        fileName = filenamify(`${resource.fileName}.${resource.hash}.${randomBytes(4).toString('hex')}${extname(resource.fileName)}`, { replacement: '-' })
        filePath = join(root, resource.domain, fileName)
      }
      break
    }
    fileName = candidate
    filePath = join(root, resource.domain, fileName)

    existedEntry = await context.db.selectFrom('snapshots').where('domainedPath', '=', `${resource.domain}/${fileName}`).selectAll().executeTakeFirst()
  }

  const fstat = await stat(filePath, { bigint: false }).catch(e => {
    if (isSystemError(e) && e.code === 'ENOENT') {
      return undefined
    }
    throw e
  })

  if (fstat) {
    // existed but not in database
    // this is a broken resource
    context.logger.warn(`Resource ${filePath} is broken. Try to fix it.`)
    const localEntry = await getResourceEntry(filePath, context, true)
    if (localEntry.sha1 === resource.hash) {
      // The file is already imported...
      // Recover db
      await context.db.insertInto('snapshots').values({
        domainedPath: entryName,
        fileType: localEntry.fileType,
        sha1: localEntry.sha1,
        size: localEntry.size,
        mtime: localEntry.mtime,
        ctime: localEntry.ctime,
        ino: localEntry.ino,
      }).execute().catch(() => undefined)
      return [filePath, true]
    } else {
      // Remove the file
      await unlink(filePath)
    }
  }

  if (dirname(resource.path) === dirname(filePath)) {
    // Just rename if they are in same dir
    await rename(resource.path, filePath)
    return [filePath, true]
  }

  // Use hard link or copy
  const linked = await linkOrCopy(resource.path, filePath)

  return [filePath, linked]
}
