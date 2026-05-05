import { ResourceMetadata } from '../ResourceMetadata'
import { ResourceContext } from '../ResourceContext'
import { ResourceTable } from '../schema'

/**
 * Safely update or insert the resource data. This will update both of the `metadata` and `uri` database.
 */
export async function upsertMetadata(
  sha1: string,
  context: ResourceContext,
  metadata?: ResourceMetadata,
  uris?: string[],
  icons?: string[],
  name?: string,
) {
  await context.db.transaction().execute(async (trx) => {
    if (metadata) {
      const data = {
        ...metadata,
      } as any
      delete data.icons
      for (const key of Object.keys(data)) {
        if (data[key] === undefined || data[key] === null) {
          delete data[key]
        }
      }
      if (name) {
        data.name = name
      }
      const table: ResourceTable = {
        sha1,
        ...data,
        name: data.name || '',
      }
      await trx
        .insertInto('resources')
        .values(table)
        .onConflict((oc) =>
          Object.keys(data).length > 0 ? oc.column('sha1').doUpdateSet(data) : oc.doNothing(),
        )
        .execute()
    }
    if (uris && uris.length > 0) {
      await trx
        .insertInto('uris')
        .values(uris.map((u) => ({ uri: u, sha1 })))
        .onConflict((b) => b.doNothing())
        .execute()
    }
    if (icons && icons.length > 0) {
      await trx
        .insertInto('icons')
        .values(icons.map((i) => ({ icon: i, sha1 })))
        .onConflict((b) => b.doNothing())
        .execute()
    }
  })
}
