import { Resource } from '@xmcl/runtime-api'
import { ClassicLevel } from 'classic-level'
import { existsSync } from 'fs'
import { remove } from 'fs-extra'
import { IResourceData, ResourceContext } from './ResourceContext'

export async function migrateResources(legacyPath: string, context: ResourceContext) {
  if (existsSync(legacyPath)) {
    const level = new ClassicLevel<string, Resource>(legacyPath, { valueEncoding: 'json' })

    const batch = context.metadata.batch()

    for await (const resource of level.values()) {
      const data: IResourceData = {
        name: resource.name,
        hashes: { sha1: resource.hash },
        icons: resource.icons || [],
        tags: resource.tags || [],
        uris: (resource as any).uri || [], // legacy resource use `uri`
      }
      Object.assign(data, resource.metadata)
      batch.put(resource.hash, data)
    }

    await batch.write()
    context.logger.log(`Migrate ${batch.length} resource metadata`)

    await level.close()
    await remove(legacyPath)
  }
}
