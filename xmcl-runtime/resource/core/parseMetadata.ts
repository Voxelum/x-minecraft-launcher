import { File, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { ResourceContext } from './ResourceContext'
import { jsonArrayFrom } from './helper'
import { upsertMetadata } from './upsertMetadata'
import { ResourceSnapshotTable } from './schema'
import { pickMetadata } from './generateResource'
import { ResourceWorkerQueuePayload } from './ResourceWorkerQueuePayload'

export async function getOrParseMetadata(file: File, record: ResourceSnapshotTable, domain: ResourceDomain, context: ResourceContext,
  job: ResourceWorkerQueuePayload,
  parse: boolean) {
  let cachedMetadata: (ResourceMetadata & { icons?: string[] }) | undefined = await context.db.selectFrom('resources')
    .selectAll()
    .select((eb) => [
      jsonArrayFrom(
        eb.selectFrom('icons').select(['icons.icon', 'icons.sha1']).whereRef('icons.sha1', '=', 'resources.sha1'),
      ).as('icons'),
    ])
    .where('sha1', '=', record.sha1)
    .executeTakeFirst()
    .then(r => r ? ({ ...pickMetadata(r), icons: r?.icons.map(i => i.icon) }) : undefined)

  if (parse) {
    if (!cachedMetadata) {
      const { metadata, uris, icons, name } = await context.parse({
        path: file.path,
        fileType: record.fileType,
        domain,
      })

      const iconPaths = await Promise.all(icons.map(icon => context.image.addImage(icon).catch(() => '')))
      const allIcons = iconPaths.filter(icon => icon)

      if (job.metadata) {
        Object.assign(metadata, job.metadata)
      }

      if (job.uris) {
        uris.push(...job.uris)
      }

      if (job.icons) {
        allIcons.push(...job.icons)
      }

      upsertMetadata(record.sha1, context, metadata, uris, allIcons, name)
        .catch((e) => {
          context.logger.error(e)
        })

      cachedMetadata = { ...pickMetadata(metadata), icons: allIcons }
    } else {
      const uris = [] as string[]
      const icons = cachedMetadata.icons || []

      if (domain === ResourceDomain.Mods && !cachedMetadata.forge && !cachedMetadata.fabric && !cachedMetadata.quilt && !cachedMetadata.neoforge) {
        const { metadata, uris, icons, name } = await context.parse({
          path: file.path,
          fileType: record.fileType,
          domain,
        })

        metadata.name = name

        if (!job.metadata) {
          job.metadata = metadata
        } else {
          Object.assign(job.metadata, metadata)
        }

        if (job.uris) {
          uris.push(...job.uris)
        } else {
          job.uris = uris
        }

        const iconPaths = await Promise.all(icons.map(icon => context.image.addImage(icon).catch(() => '')))
        const allIcons = iconPaths.filter(icon => icon)

        if (job.icons) {
          job.icons.push(...allIcons)
        } else {
          job.icons = allIcons
        }
      }

      if (job.metadata) {
        Object.assign(cachedMetadata, job.metadata)
      }
      if (job.uris) {
        uris.push(...job.uris)
      }
      if (job.icons) {
        icons.push(...job.icons)
      }

      if (job.metadata || job.uris || job.icons) {
        upsertMetadata(record.sha1, context, cachedMetadata, uris, icons, cachedMetadata.name)
          .catch((e) => {
            context.logger.error(e)
          })
      }

      cachedMetadata.icons = icons
    }
  }
  return cachedMetadata
}
