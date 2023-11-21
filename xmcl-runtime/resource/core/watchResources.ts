import { ResourceDomain } from '@xmcl/runtime-api'
import watch from 'node-watch'
import { basename, dirname } from 'path'
import { ResourceContext } from './ResourceContext'
import { generateResource } from './generateResource'
import { getResourceEntry } from './getResourceEntry'
import { parseMetadata } from './parseMetadata'
import { shouldIgnoreFile } from './pathUtils'
import { ResourceDecoratedMetadata, ResourceSnapshotTable } from './schema'
import { upsertMetadata } from './upsertMetadata'
import { jsonArrayFrom } from './helper'

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
          const entry = await context.db.deleteFrom('snapshots').where('domainedPath', '=', `${domain}/${fileName}`)
            .returning('sha1 as sha1')
            .executeTakeFirst()
          context.eventBus.emit('resourceRemove', { sha1: entry?.sha1, domain })
        } catch (e) {
          context.logger.warn(e)
        }
      }
    } else {
      if (path.endsWith('.png') || shouldIgnoreFile(path)) {
        return
      }

      // TODO: lock the path for handle watcher
      const _entry = await getResourceEntry(path, context, true)
      const domainedPath = `${domain}/${fileName}`
      const entry: ResourceSnapshotTable = {
        domainedPath,
        ino: _entry.ino,
        ctime: _entry.ctime,
        mtime: _entry.mtime,
        size: _entry.size,
        fileType: _entry.fileType,
        sha1: _entry.sha1,
      }

      // Update the entry
      await context.db
        .insertInto('snapshots')
        .values(entry)
        .onConflict(oc => oc.column('domainedPath').doUpdateSet(entry))
        .execute()

      const result = await context.db
        .selectFrom('resources')
        .where('sha1', '=', entry.sha1)
        .selectAll('resources')
        .select((eb) => [
          jsonArrayFrom(
            eb.selectFrom('icons').select(['icons.icon', 'icons.sha1']).where('sha1', '=', entry.sha1),
          ).as('icons'),
          jsonArrayFrom(
            eb.selectFrom('uris').select(['uris.uri', 'uris.sha1']).where('sha1', '=', entry.sha1),
          ).as('uris'),
          jsonArrayFrom(
            eb.selectFrom('tags').select(['tags.tag', 'tags.sha1']).where('sha1', '=', entry.sha1),
          ).as('tags'),
        ])
        .executeTakeFirst()
      let _metadata: ResourceDecoratedMetadata | undefined = result
        ? {
          name: result.name,
          icons: result.icons.map((i) => i.icon),
          uris: result.uris.map((i) => i.uri),
          tags: result.tags?.map((i) => i.tag),
          forge: result.forge,
          liteloader: result.liteloader,
          fabric: result.fabric,
          quilt: result.quilt,
          resourcepack: result.resourcepack,
          'mcbbs-modpack': result['mcbbs-modpack'],
          'modrinth-modpack': result['modrinth-modpack'],
          'curseforge-modpack': result['curseforge-modpack'],
          modpack: result.modpack,
          save: result.save,
          shaderpack: result.shaderpack,
          instance: result.instance,
          github: result.github,
          curseforge: result.curseforge,
          modrinth: result.modrinth,
          gitlab: result.gitlab,
        }
        : undefined

      if (!_metadata) {
        try {
          const { metadata, uris, icons, name } = await parseMetadata(path, entry.fileType, domain, context)
          _metadata = await upsertMetadata(metadata, uris, icons, name, entry.sha1, context)
        } catch (e) {
          if ((e as any).message === 'end of central directory record signature not found') {
            // TODO: log telemetry?
            context.logger.warn(`Invalid resource ${path}`)
            return
          }
          throw e
        }
      }

      // TODO: make these two into one event
      if ('path' in _entry) {
        context.eventBus.emit('resourceAdd', generateResource(dirname(folder), entry, _metadata))
      } else {
        context.eventBus.emit('resourceUpdate', [{ hash: _entry.sha1, metadata: _metadata, name: _metadata.name, uris: _metadata.uris, icons: _metadata.icons, tags: _metadata.tags }])
      }
    }
  })
}
