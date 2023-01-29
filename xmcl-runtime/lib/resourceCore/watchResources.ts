import { ResourceDomain } from '@xmcl/runtime-api'
import watch from 'node-watch'
import { basename, dirname } from 'path'
import { generateResource } from './generateResource'
import { getResourceEntry } from './getResourceEntry'
import { parseMetadata } from './parseMetadata'
import { shouldIgnoreFile } from './pathUtils'
import { resolveDomain } from './resolveDomain'
import { ResourceContext, ResourceEntryCache } from './ResourceContext'
import { upsertMetadata } from './upsertMetadata'

export function watchResources(folder: string, context: ResourceContext) {
  const domain = basename(folder) as ResourceDomain
  return watch(folder, async (event, path) => {
    const fileName = basename(path)
    if (event === 'remove') {
      if (path.endsWith('.json') || path.endsWith('.png') || shouldIgnoreFile(path)) {
        // json removed means the resource is totally removed
      } else {
        // Remove cached entry
        try {
          const entry = await context.fileNameSnapshots[domain].get(fileName)
          const batch = context.snapshot.batch()
          batch.del(`!${domain}!${entry.fileName}`)
          batch.del(`!sha1!${entry.sha1}`)
          batch.del(`!ino!${entry.ino}`)
          await batch.write()
          context.eventBus.emit('resourceRemove', { sha1: entry.sha1, domain })
        } catch (e) {
          context.logger.warn(e)
        }
      }
    } else {
      if (path.endsWith('.png') || shouldIgnoreFile(path)) {
        return
      }

      // TODO: lock the path for handle watcher
      const cachedEntry = await context.fileNameSnapshots[domain].get(fileName).catch(() => undefined)
      const _entry = await getResourceEntry(path, context, true)
      const entry: ResourceEntryCache = {
        fileName,
        domain,
        ..._entry,
      }

      // Update the entry
      const batch = context.snapshot.batch()
      batch.put(`!${domain}!${entry.fileName}`, entry)
      batch.put(`!sha1!${entry.sha1}`, entry)
      batch.put(`!ino!${entry.ino}`, entry)
      await batch.write()

      let _metadata = await context.metadata.get(entry.sha1).catch(() => undefined)
      if (!_metadata) {
        const { metadata, uris, icons, name } = await parseMetadata(path, entry.fileType, domain, context)
        const data = await upsertMetadata(metadata, uris, icons, name, entry.sha1, context)
        _metadata = data
      }

      if (cachedEntry) {
        context.eventBus.emit('resourceUpdate', generateResource(dirname(folder), entry, _metadata))
      } else {
        context.eventBus.emit('resourceAdd', generateResource(dirname(folder), entry, _metadata))
      }
    }
  })
}
