import { ResourceMetadata } from '@xmcl/runtime-api'
import { ResourceContext } from './ResourceContext'

/**
 * Safely update or insert the resource data. This will update both of the `metadata` and `uri` database.
 */
export async function upsertMetadata(metadata: ResourceMetadata, uris: string[], icons: string[], name: string, sha1: string, context: ResourceContext) {
  // TODO: Should lock for sha1 modification
  let data = await context.metadata.get(sha1).catch(() => undefined)
  if (data) {
    // Merge with current data
    data.hashes.sha1 = sha1
    Object.assign(data, metadata)
    data.icons = [...new Set(icons.concat(data.icons))]
    data.uris = [...new Set(uris.concat(data.uris))]
  } else {
    // Add fresh data
    data = {
      name,
      hashes: {
        sha1,
      },
      tags: [],
      icons: [],
      uris,
      ...metadata,
    }
  }
  await context.metadata.put(sha1, data)
  const batch = context.uri.batch()
  for (const u of data.uris) {
    batch.put(u, sha1)
  }
  await batch.write()

  return data
}
