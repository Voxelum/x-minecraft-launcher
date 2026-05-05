import { ResourceDomain } from '../ResourceDomain'
import { ResourceMetadata } from '../ResourceMetadata'
import { File } from '../File'
import { pickMetadata } from './generateResource'
import type { ResourceContext } from '../ResourceContext'
import { ResourceWorkerQueuePayload } from '../ResourceWorkerQueuePayload'
import { ResourceSnapshotTable } from '../schema'
import { jsonArrayFrom } from './sqlHelper'
import { upsertMetadata } from './upsertMetadata'

export async function getOrParseMetadata(
  file: File,
  record: ResourceSnapshotTable,
  domain: ResourceDomain,
  context: ResourceContext,
  job: ResourceWorkerQueuePayload,
  parse: boolean,
) {
  let cachedMetadata: (ResourceMetadata & { icons?: string[] }) | undefined = await context.db
    .selectFrom('resources')
    .selectAll()
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom('icons')
          .select(['icons.icon', 'icons.sha1'])
          .whereRef('icons.sha1', '=', 'resources.sha1'),
      ).as('icons'),
    ])
    .where('sha1', '=', record.sha1)
    .executeTakeFirst()
    .then((r) => (r ? { ...pickMetadata(r), icons: r?.icons.map((i) => i.icon) } : undefined))

  function handleParseError(err: any): never {
    // create a temp exception to bypass telemetry
    if (
      err.name === 'InvalidZipFileError' ||
      err.name === 'InvalidZipFile' ||
      err.name === 'MultiDiskZipFileError' ||
      err.name === 'InvalidCentralDirectoryFileHeaderError' ||
      err.name === 'CompressedUncompressedSizeMismatchError' ||
      err.name === 'FileNotFoundError' ||
      err.name === 'PermissionError'
    ) {
      context.throwException({ type: 'parseResourceException', code: err.name })
    }
    throw err
  }

  if (parse) {
    if (!cachedMetadata) {
      const { metadata, uris, icons, name } = await context
        .parse({
          path: file.path,
          fileType: record.fileType,
          domain,
        })
        .catch(handleParseError)

      const iconPaths = await Promise.all(
        icons.map((icon) => context.cacheImage(icon).catch(() => '')),
      )
      const allIcons = iconPaths.filter((icon) => icon)

      if (job.metadata) {
        Object.assign(metadata, job.metadata)
      }

      if (job.uris) {
        uris.push(...job.uris)
      }

      if (job.icons) {
        allIcons.push(...job.icons)
      }

      upsertMetadata(record.sha1, context, metadata, uris, allIcons, name).catch((e) => {
        context.onError(e)
      })

      cachedMetadata = { ...pickMetadata(metadata), icons: allIcons }
    } else {
      const uris = [] as string[]
      const icons = cachedMetadata.icons || []

      if (Object.values(cachedMetadata).every((v) => !v || !v.length) && file.isDirectory) {
        return
      }

      if (
        domain === ResourceDomain.Mods &&
        !cachedMetadata.forge &&
        !cachedMetadata.fabric &&
        !cachedMetadata.quilt &&
        !cachedMetadata.neoforge
      ) {
        const { metadata, uris, icons, name } = await context
          .parse({
            path: file.path,
            fileType: record.fileType,
            domain,
          })
          .catch(handleParseError)

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

        const iconPaths = await Promise.all(
          icons.map((icon) => context.cacheImage(icon).catch(() => '')),
        )
        const allIcons = iconPaths.filter((icon) => icon)

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
        upsertMetadata(
          record.sha1,
          context,
          cachedMetadata,
          uris,
          icons,
          cachedMetadata.name,
        ).catch((e) => {
          context.onError(e)
        })
      }

      cachedMetadata.icons = icons
    }
  }
  return cachedMetadata
}
