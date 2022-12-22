import { ResourceDomain } from '@xmcl/runtime-api'
import { stat, unlink } from 'fs/promises'
import { basename, join } from 'path'
import { parseMetadata } from './parseMetadata'
import { ResourceContext, ResourceEntryCache } from './ResourceContext'

/**
 * Add the new resource to `metadata` database
 */
async function addResource(file: string, sha1: string, fileType: string, domain: ResourceDomain, context: ResourceContext): Promise<void> {
  // Parse resource
  const { name, metadata, uris, icons } = await parseMetadata(file, fileType, domain, context)

  // TODO: Should lock for xxhash modification
  // Add fresh data
  await context.metadata.put(sha1, {
    name,
    hashes: {
      sha1,
    },
    tags: [],
    icons,
    uris,
    ...metadata,
  })

  const batch = context.uri.batch()
  for (const u of uris) {
    batch.put(u, sha1)
  }
  await batch.write()
}

/**
 * Load the resource from a specific folder
 * @param folder The domain folder
 * @param context The resource context
 */
export async function loadResources(folder: string, files: string[], context: ResourceContext) {
  const caches: Record<string, ResourceEntryCache> = {}
  const domain = basename(folder) as ResourceDomain

  for await (const cache of context.fileNameSnapshots[domain].values()) {
    caches[cache.fileName] = cache
  }

  const toUpdate: ResourceEntryCache[] = []
  const toCheck: ResourceEntryCache[] = []
  await Promise.all(files.map(async (file) => {
    const filePath = join(folder, file)
    const fstat = await stat(filePath).catch(() => undefined)
    if (!fstat?.size) {
      context.logger.warn(`Remove dead file ${filePath}`)
      await unlink(filePath).catch(() => undefined)
      return
    }
    const cached = caches[file]
    if (cached) {
      // File existed, check file!
      if (cached.ino !== fstat.ino || cached.size !== fstat.size || cached.mtime !== fstat.mtimeMs || cached.ctime !== fstat.ctimeMs) {
        // File is not matched (file is modified!)
        const [sha1, fileType] = await context.hashAndFileType(filePath, fstat.size)
        toUpdate.push({
          fileName: file,
          ino: fstat.ino,
          size: fstat.size,
          ctime: fstat.ctimeMs,
          mtime: fstat.mtimeMs,
          domain,
          sha1: sha1,
          fileType,
        })
      } else {
        toCheck.push(cached)
      }
    } else {
      // No such file
      const [sha1, fileType] = await context.hashAndFileType(filePath, fstat.size)
      toUpdate.push({
        fileName: file,
        ino: fstat.ino,
        size: fstat.size,
        ctime: fstat.ctimeMs,
        mtime: fstat.mtimeMs,
        domain,
        sha1,
        fileType,
      })
    }
    // delete visited file
    delete caches[file]
  }).map(p => p.catch((e) => {
    context.logger.warn('Fail to load resource %o', e)
  })))

  // remaining file should be removed
  const toRemove: ResourceEntryCache[] = Object.values(caches)

  context.logger.log(`Load ${folder} toRemove=${toRemove.length} toUpdate=${toUpdate.length} toCheck=${toCheck.length}`)

  // Update the cache snapshot in batch atomically
  const batch = context.snapshot.batch()
  for (const c of toRemove) {
    batch.del(`!${domain}!${c.fileName}`)
    batch.del(`!sha1!${c.sha1}`)
    batch.del(`!ino!${c.ino}`)
  }
  for (const c of toUpdate) {
    batch.put(`!${domain}!${c.fileName}`, c)
    batch.put(`!sha1!${c.sha1}`, c)
    batch.put(`!ino!${c.ino}`, c)
  }
  await batch.write()

  // Need to check all resources
  const pending = toUpdate.concat(toCheck)
  const stored = await context.metadata.getMany(pending.map(f => f.sha1))
  const tasks: Promise<void>[] = []
  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i]
    const metadata = stored[i]
    if (!metadata && entry.fileType === 'zip') {
      const filePath = join(folder, entry.fileName)
      context.logger.log(`Parse ${filePath} as its metadata is missing`)
      // No metadata, need to parse
      tasks.push(addResource(filePath, entry.sha1, entry.fileType, domain, context).catch((e) => {
        context.logger.warn(`Fail to parse resource ${folder}/${entry.fileName}. %o`, e)
      }))
    }
  }
  await Promise.all(tasks)

  context.logger.log(`Done to load resource domain ${domain}`)
}
