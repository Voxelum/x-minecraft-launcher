import { ResourceDomain } from '@xmcl/runtime-api'
import { stat, unlink } from 'fs-extra'
import { join } from 'path'
import { ResourceContext } from './ResourceContext'
import { parseMetadata } from './parseMetadata'
import { shouldIgnoreFile } from './pathUtils'
import { ResourceSnapshotTable, ResourceTable } from './schema'

/**
 * Add the new resource to `metadata` database
 */
async function addResource(file: string, sha1: string, fileType: string, domain: ResourceDomain, context: ResourceContext): Promise<void> {
  // Parse resource
  const { name, metadata, uris, icons } = await parseMetadata(file, fileType, domain, context)

  const resourceTable: ResourceTable = {
    name,
    sha1,
    ...metadata,
  }
  // Add fresh data
  await context.db.transaction().execute(async (trx) => {
    await trx.insertInto('resources').values(resourceTable).execute()
    if (uris.length > 0) {
      await trx.insertInto('uris').values(uris.map(u => ({ uri: u, sha1 })))
        .onConflict((el) => el.doNothing()).execute()
    }
    if (icons.length > 0) {
      await trx.insertInto('icons').values(icons.map(i => ({ icon: i, sha1 })))
        .onConflict((el) => el.doNothing()).execute()
    }
  })
}

/**
 * Load the resource from a specific folder
 * @param root The root folder
 * @param folder The domain name
 * @param context The resource context
 */
export async function loadResources(root: string, domain: ResourceDomain, files: string[], context: ResourceContext) {
  const caches: Record<string, ResourceSnapshotTable> = {}
  const folder = join(root, domain)

  for (const cache of await context.db.selectFrom('snapshots')
    .where('domainedPath', 'like', `${domain}/%`)
    .selectAll().execute()) {
    caches[cache.domainedPath] = cache
  }

  const toUpdate: ResourceSnapshotTable[] = []
  const toCheck: ResourceSnapshotTable[] = []
  await Promise.all(files.map(async (file) => {
    if (shouldIgnoreFile(file)) return
    const filePath = join(folder, file)
    const fstat = await stat(filePath).catch(() => undefined)
    if (!fstat?.size) {
      context.logger.warn(`Remove dead file ${filePath}`)
      await unlink(filePath).catch(() => undefined)
      return
    }
    const domainedPath = `${domain}/${file}`
    const cached = caches[domainedPath]
    if (cached) {
      // File existed, check file!
      if (cached.ino !== fstat.ino || cached.size !== fstat.size || cached.mtime !== fstat.mtimeMs || cached.ctime !== fstat.ctimeMs) {
        // File is not matched (file is modified!)
        const [sha1, fileType] = await context.hashAndFileType(filePath, fstat.size)
        toUpdate.push({
          domainedPath,
          ino: fstat.ino,
          size: fstat.size,
          ctime: fstat.ctimeMs,
          mtime: fstat.mtimeMs,
          sha1,
          fileType,
        })
      } else {
        toCheck.push(cached)
      }
    } else {
      // No such file
      const [sha1, fileType] = await context.hashAndFileType(filePath, fstat.size)
      toUpdate.push({
        domainedPath,
        ino: fstat.ino,
        size: fstat.size,
        ctime: fstat.ctimeMs,
        mtime: fstat.mtimeMs,
        sha1,
        fileType,
      })
    }
    // delete visited file
    delete caches[domainedPath]
  }).map(p => p.catch((e) => {
    context.logger.warn('Fail to load resource %o', e)
  })))

  // remaining file should be removed
  const toRemove: ResourceSnapshotTable[] = Object.values(caches)

  context.logger.log(`Load ${folder} toRemove=${toRemove.length} toUpdate=${toUpdate.length} toCheck=${toCheck.length}`)

  // Update the cache snapshot in batch atomically
  await context.db.transaction().execute(async (trx) => {
    if (toRemove.length > 0) {
      await trx.deleteFrom('snapshots')
        .where('domainedPath', 'in', toRemove.map(c => c.domainedPath)).execute()
    }
    if (toUpdate.length > 0) {
      await trx.insertInto('snapshots')
        .values(toUpdate).onConflict(oc => oc.column('domainedPath').doUpdateSet((eb) => ({
          size: eb.ref('excluded.size'),
          ctime: eb.ref('excluded.ctime'),
          mtime: eb.ref('excluded.mtime'),
          sha1: eb.ref('excluded.sha1'),
          ino: eb.ref('excluded.ino'),
        }))).execute()
    }
  })

  // Need to check all resources
  const pending = toUpdate.concat(toCheck)
  const stored: Record<string, ResourceTable> = {}
  for (const metadata of await context.db.selectFrom('resources')
    .where('sha1', 'in', pending.map(f => f.sha1))
    .selectAll()
    .execute()) {
    stored[metadata.sha1] = metadata
  }
  const tasks: Promise<void>[] = []
  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i]
    const metadata = stored[entry.sha1]
    if (!metadata && entry.fileType === 'zip') {
      const filePath = join(root, entry.domainedPath)
      context.logger.log(`Parse ${filePath} as its metadata is missing`)
      // No metadata, need to parse
      tasks.push(addResource(filePath, entry.sha1, entry.fileType, domain, context).catch((e) => {
        context.logger.warn(`Fail to parse resource ${entry.domainedPath}. %o`, e)
      }))
    }
  }
  await Promise.all(tasks)

  context.logger.log(`Done to load resource domain ${domain}`)
}
