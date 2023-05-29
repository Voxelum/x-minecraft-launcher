import { ResourceDomain } from '@xmcl/runtime-api'
import { randomBytes } from 'crypto'
import filenamify from 'filenamify'
import { rename } from 'fs/promises'
import { dirname, extname, join } from 'path'
import { linkOrCopy } from '../util/fs'
import { getResourceEntry } from './getResourceEntry'
import { ResourceContext } from './ResourceContext'

export async function tryPersistResource(resource: { fileName: string; domain: ResourceDomain; hash: string; path: string }, root: string, context: ResourceContext) {
  const backup = [
    filenamify(`${resource.fileName}.${resource.hash.slice(0, 6)}${extname(resource.fileName)}`, { replacement: '-' }),
    filenamify(`${resource.fileName}.${resource.hash}${extname(resource.fileName)}`, { replacement: '-' }),
  ]
  let fileName = filenamify(resource.fileName, { replacement: '-' })
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
      return filePath
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

  if (dirname(resource.path) === dirname(filePath)) {
    // Just rename if they are in same dir
    await rename(resource.path, filePath)
  } else {
    // Use hard link or copy
    await linkOrCopy(resource.path, filePath)
  }

  return filePath
}
