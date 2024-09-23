import { ResourceMetadata } from '@xmcl/runtime-api'
import { ResourceContext } from './ResourceContext'
import { ResourceTable } from './schema'

/**
 * Safely update or insert the resource data. This will update both of the `metadata` and `uri` database.
 */
export async function upsertMetadata(metadata: ResourceMetadata, uris: string[], icons: string[], name: string, sha1: string, context: ResourceContext) {
  const data = await context.db.transaction().execute(async (trx) => {
    const table: ResourceTable = {
      sha1,
      name,
      ...metadata,
    }
    const _resource = await trx
      .insertInto('resources')
      .values(table)
      .onConflict(oc => oc.column('sha1').doUpdateSet({
        name: table.name,
        ...metadata,
      }))
      .returningAll()
      .executeTakeFirst()
    const _uris = uris.length > 0 ? await trx.insertInto('uris').values(uris.map(u => ({ uri: u, sha1 }))).onConflict((b) => b.doNothing()).returningAll().execute() : []
    const _icons = icons.length > 0 ? await trx.insertInto('icons').values(icons.map(i => ({ icon: i, sha1 }))).onConflict((b) => b.doNothing()).returningAll().execute() : []
    return {
      name,
      ..._resource,
      uris: _uris.map(u => u.uri),
      icons: _icons.map(i => i.icon),
      tags: [] as string[],
    }
  })

  return data
}
