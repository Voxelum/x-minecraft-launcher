import { ResourceDomain, ResourceMetadata, ResourceType } from '@xmcl/runtime-api'
import { AbstractLevel, AbstractSublevel } from 'abstract-level'
import { ClassicLevel } from 'classic-level'
import { remove } from 'fs-extra/esm'
import { Logger } from '../util/log'
import { ResourceContext } from './ResourceContext'
import { ResourceSnapshotTable, ResourceTable } from './schema'

interface IResourceData extends ResourceMetadata {
  /**
   * The human readable name or alias
   */
  name: string
  hashes: {
    sha1: string
    sha256?: string
  }
  icons: string[]
  /**
   * The tag on this file. Used for indexing.
   */
  tags: string[]
  /**
   * The uris of the resource. Used for indexing
   */
  uris: string[]
}

interface ResourceEntry {
  ino: number
  ctime: number
  mtime: number
  size: number
  fileType: string
  /**
   * The sha1 string
   */
  sha1: string
}

interface ResourceEntryCache extends ResourceEntry {
  /**
   * The basename of the file including the extension
   */
  fileName: string
  domain: ResourceDomain
}

/**
 * The total snapshot database for file cache
 */
type ResourceSnapshotDatabase = AbstractLevel<Buffer, string, ResourceEntryCache>
/**
 * The domains like `!mods!` or `!resourcepacks!` prefixed sub-level of `ResourceSnapshotDatabase`
 *
 * The key is the file name, and the value is the resource entry
 */
type ResourceFileNameSnapshotDatabase = AbstractSublevel<ResourceSnapshotDatabase, Buffer, string, ResourceEntryCache>
/**
 * The sha1 to resource metadata database
 */
type ResourceMetaDatabase = AbstractLevel<Buffer, string, IResourceData>

/**
 * Migrate the domain cache entry to the new sqlite database
 */
async function migrateDomain(snapshot: ResourceSnapshotDatabase, current: ResourceContext, domain: ResourceDomain) {
  const db = snapshot.sublevel(domain, { valueEncoding: 'json' }) as ResourceFileNameSnapshotDatabase
  for await (const cache of db.values()) {
    const transformed: ResourceSnapshotTable = {
      ino: cache.ino,
      ctime: cache.ctime,
      mtime: cache.mtime,
      size: cache.size,
      fileType: cache.fileType,
      sha1: cache.sha1,
      domainedPath: `${domain}/${cache.fileName}`,
    }
    await current.db.insertInto('snapshots')
      .values(transformed)
      .onConflict(oc => oc.doNothing())
      .execute()
      .catch(() => { /* ignore error */ })
  }
}

/**
 * Migrate the legacy level db data to the new sqlite database
 */
export async function migrateLevelDBData(levelPath: string, current: ResourceContext, logger: Logger) {
  const level = new ClassicLevel(levelPath)

  const metadata = level.sublevel('metadata', { valueEncoding: 'json' }) as ResourceMetaDatabase

  for await (const resource of metadata.values()) {
    try {
      const transformed: ResourceTable = {
        forge: resource.forge,
        fabric: resource.fabric,
        liteloader: resource.liteloader,
        quilt: resource.quilt,
        curseforge: resource.curseforge,
        modrinth: resource.modrinth,
        modpack: resource.modpack,
        save: resource.save,
        resourcepack: resource.resourcepack,
        shaderpack: resource.shaderpack,
        instance: resource.instance,
        github: resource.github,
        gitlab: resource.gitlab,
        [ResourceType.CurseforgeModpack]: resource[ResourceType.CurseforgeModpack],
        [ResourceType.McbbsModpack]: resource[ResourceType.McbbsModpack],
        [ResourceType.ModrinthModpack]: resource[ResourceType.ModrinthModpack],
        name: resource.name,
        sha1: resource.hashes.sha1,
        sha256: resource.hashes.sha256,
      }

      const clean = Object.entries(transformed).reduce((acc, [key, value]) => {
        if (value === undefined) return acc
        return { ...acc, [key]: value }
      }, {} as ResourceTable)

      await current.db.insertInto('resources')
        .values(clean)
        .onConflict((oc) => oc.column('sha1').doUpdateSet(clean))
        .execute()
      await current.db.insertInto('uris')
        .values(resource.uris.map((uri) => ({ sha1: resource.hashes.sha1, uri })))
        .onConflict((r) => r.doNothing())
        .execute()
      await current.db.insertInto('tags')
        .values(resource.tags.map((tag) => ({ sha1: resource.hashes.sha1, tag })))
        .onConflict((r) => r.doNothing())
        .execute()
      await current.db.insertInto('icons')
        .values(resource.icons.map((icon) => ({ sha1: resource.hashes.sha1, icon })))
        .onConflict((r) => r.doNothing())
        .execute()
    } catch (e) {
      logger.warn(`Fail to migrate resource ${resource.name}`)
      logger.warn(e)
    }
  }

  const snapshot = level.sublevel('snapshot', { valueEncoding: 'json' }) as ResourceSnapshotDatabase
  await Promise.all([
    migrateDomain(snapshot, current, ResourceDomain.Mods),
    migrateDomain(snapshot, current, ResourceDomain.Saves),
    migrateDomain(snapshot, current, ResourceDomain.ResourcePacks),
    migrateDomain(snapshot, current, ResourceDomain.ShaderPacks),
    migrateDomain(snapshot, current, ResourceDomain.Modpacks),
    migrateDomain(snapshot, current, ResourceDomain.Unclassified),
  ])

  await level.close().catch(() => undefined)
  await remove(levelPath)
}
