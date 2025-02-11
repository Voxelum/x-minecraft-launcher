import { File, Resource, ResourceMetadata, ResourceType } from '@xmcl/runtime-api'
import { ResourceSnapshotTable } from './schema'

// export type QueryOptions = {
//   domain: ResourceDomain
//   pagination?: Pagination
// } | {
//   domainedPath: string | string[]
// } | {
//   sha1: string | string[]
// } | {
//   uris: string[]
// } | {
//   startsWithUri: string
// } | {
//   ino: number
// } | {
//   domain: ResourceDomain
//   keyword: string
//   pagination?: Pagination
// }

// export async function getResourceAndMetadata(context: ResourceContext, query: QueryOptions) {
//   let _query = context.db.selectFrom('snapshots')
//   let pagination: Pagination | undefined

//   if ('domain' in query) {
//     pagination = query.pagination
//     if ('keyword' in query) {
//       _query = _query.where('snapshots.domainedPath', 'like', `${query.domain}/%${query.keyword}%`)
//     } else {
//       _query = _query.where('snapshots.domainedPath', 'like', `${query.domain}/%`)
//     }
//   } else if ('domainedPath' in query) {
//     if (typeof query.domainedPath === 'string') {
//       _query = _query.where('snapshots.domainedPath', '=', query.domainedPath)
//     } else {
//       _query = _query.where('snapshots.domainedPath', 'in', query.domainedPath)
//     }
//   } else if ('sha1' in query) {
//     if (typeof query.sha1 === 'string') {
//       _query = _query.where('snapshots.sha1', '=', query.sha1)
//     } else {
//       _query = _query.where('snapshots.sha1', 'in', query.sha1)
//     }
//   } else if ('ino' in query) {
//     _query = _query.where('snapshots.ino', '=', query.ino)
//   } else if ('uris' in query) {
//     // _query = _query.where('snapshots.sha1', 'in', (eb) => eb.selectFrom('uris').select('uris.uri').where('uris.uri', 'in', query.uris))
//     const uris = await context.db.selectFrom('uris').where('uris.uri', 'in', query.uris).select('uris.sha1').execute()
//     _query = _query.where('snapshots.sha1', 'in', uris.map(v => v.sha1))
//   } else if ('startsWithUri' in query) {
//     // _query = _query.where('snapshots.sha1', 'in', (eb) => eb.selectFrom('uris').select('uris.sha1').where('uris.uri', 'like', `${query.startsWithUri}%`))
//     const uris = await context.db.selectFrom('uris')
//       .where('uris.uri', 'like', `${query.startsWithUri}%`).select('uris.sha1').execute()
//     _query = _query.where('snapshots.sha1', 'in', uris.map(v => v.sha1))
//   }

//   const result = await _query
//     .leftJoin('resources', 'snapshots.sha1', 'resources.sha1')
//     .select((eb) => [
//       jsonArrayFrom(
//         eb.selectFrom('icons').select(['icons.icon', 'icons.sha1']).whereRef('icons.sha1', '=', 'snapshots.sha1'),
//       ).as('icons'),
//       jsonArrayFrom(
//         eb.selectFrom('uris').select(['uris.uri', 'uris.sha1']).whereRef('uris.sha1', '=', 'snapshots.sha1'),
//       ).as('uris'),
//       jsonArrayFrom(
//         eb.selectFrom('tags').select(['tags.tag', 'tags.sha1']).whereRef('tags.sha1', '=', 'snapshots.sha1'),
//       ).as('tags'),
//     ])
//     .select([
//       'snapshots.mtime', 'snapshots.ino', 'snapshots.domainedPath', 'snapshots.fileType', 'snapshots.sha1',
//       'name',
//       'curseforge', 'modrinth',
//       'github', 'gitlab',
//       'instance',
//       'resources.forge',
//       'resources.fabric',
//       'resources.liteloader',
//       'resources.quilt',
//       'resources.save',
//       'resources.resourcepack',
//       'resources.shaderpack',
//       'resources.modpack',
//       'resources.modrinth-modpack', 'resources.curseforge-modpack', 'resources.mcbbs-modpack',
//       'resources.mmc-modpack',
//     ])
//     .$if(!!pagination, (eb) => eb.limit(pagination!.count).offset(pagination!.offset))
//     .execute()

//   return result.map((r) => ({
//     ...r,
//     name: r.name || basename(r.domainedPath),
//     icons: r.icons.map((i) => i.icon),
//     uris: r.uris.map((u) => u.uri),
//     tags: r.tags.map((t) => t.tag),
//     ino: Number(r.ino),
//     size: Number(r.size),
//     mtime: Number(r.mtime),
//     ctime: Number(r.ctime),
//   } as ResourceDecoratedMetadata & ResourceSnapshotTable))
// }

export function pickMetadata(metadata: ResourceMetadata): ResourceMetadata {
  return {
    neoforge: metadata.neoforge,
    [ResourceType.Forge]: metadata[ResourceType.Forge],
    [ResourceType.Fabric]: metadata[ResourceType.Fabric],
    [ResourceType.Liteloader]: metadata[ResourceType.Liteloader],
    [ResourceType.Quilt]: metadata[ResourceType.Quilt],
    [ResourceType.ResourcePack]: metadata[ResourceType.ResourcePack],
    [ResourceType.CurseforgeModpack]: metadata[ResourceType.CurseforgeModpack],
    [ResourceType.McbbsModpack]: metadata[ResourceType.McbbsModpack],
    [ResourceType.MMCModpack]: metadata[ResourceType.MMCModpack],
    [ResourceType.ModrinthModpack]: metadata[ResourceType.ModrinthModpack],
    [ResourceType.Modpack]: metadata[ResourceType.Modpack],
    [ResourceType.Save]: metadata[ResourceType.Save],
    [ResourceType.ShaderPack]: metadata[ResourceType.ShaderPack],
    instance: metadata.instance,
    github: metadata.github,
    curseforge: metadata.curseforge,
    modrinth: metadata.modrinth,
    gitlab: metadata.gitlab,
  }
}

export function generateResourceV3(file: File, record: ResourceSnapshotTable, metadata: ResourceMetadata & { icons?: string[] }): Resource {
  const resource: Resource = {
    version: 3,
    ...file,
    name: metadata.name ?? file.fileName,
    hash: record.sha1,
    metadata: pickMetadata(metadata),
    icons: metadata.icons,
  }
  return resource
}
