import { join } from 'path'
import { File } from './File'
import { Resource } from './Resource'
import { ResourceContext } from './ResourceContext'
import { ResourceMetadata } from './ResourceMetadata'
import { ResourceWorkerQueuePayload } from './ResourceWorkerQueuePayload'
import { UpdateResourcePayload } from './ResourcesState'
import { generateResourceV3, pickMetadata } from './core/generateResource'
import { getFile } from './core/getFile'
import { isSnapshotValid, takeSnapshot } from './core/takeSnapshot'
import { upsertMetadata } from './core/upsertMetadata'
import {
  WatchResourceDirectoryOptions,
  watchResourcesDirectory,
} from './core/watchResourcesDirectory'
import { ResourceSnapshotTable, ResourceUriTable } from './schema'
import { AnyError } from '@xmcl/utils'

export class ResourceManager {
  #watched: Record<string, { enqueue: (job: ResourceWorkerQueuePayload) => void }> = {}

  constructor(readonly context: ResourceContext) {}

  async getHashByUri(uri: string): Promise<string | undefined> {
    return this.getHashesByUris([uri]).then((v) => v[0])
  }

  async getHashesByUris(uri: string[]): Promise<string[]> {
    const uris = await this.context.db
      .selectFrom('uris')
      .where('uris.uri', 'in', uri)
      .select('uris.sha1')
      .execute()
    return uris ? uris.map((v) => v.sha1) : []
  }

  async getUrisByHash(sha1: string[]): Promise<ResourceUriTable[]> {
    const uris = await this.context.db
      .selectFrom('uris')
      .where('uris.sha1', 'in', sha1)
      .selectAll()
      .execute()
    return uris || []
  }

  async getUriByHash(sha1: string): Promise<string[]> {
    const uris = await this.context.db
      .selectFrom('uris')
      .where('uris.sha1', '=', sha1)
      .select('uris.uri')
      .execute()
    return uris ? uris.map((v) => v.uri) : []
  }

  async getSnapshotsByIno(inos: number[]): Promise<ResourceSnapshotTable[]> {
    const items = await this.context.db
      .selectFrom('snapshots')
      .selectAll()
      .where('snapshots.ino', 'in', inos)
      .execute()
    return items || []
  }

  async getSnapshotByIno(ino: number): Promise<ResourceSnapshotTable | undefined> {
    return this.getSnapshotsByIno([ino]).then((v) => v[0])
  }

  async getSnapshotsByHash(sha1: string[]): Promise<ResourceSnapshotTable[]> {
    const items = await this.context.db
      .selectFrom('snapshots')
      .selectAll()
      .where('snapshots.sha1', 'in', sha1)
      .execute()
    return items || []
  }

  async getSnapshotByHash(sha1: string): Promise<ResourceSnapshotTable | undefined> {
    return this.getSnapshotsByHash([sha1]).then((v) => v[0])
  }

  async validateSnapshot(snapshot: ResourceSnapshotTable): Promise<boolean> {
    return (await this.validateSnapshotFile(snapshot)) !== undefined
  }

  async validateSnapshotFile(snapshot?: ResourceSnapshotTable): Promise<File | undefined> {
    if (!snapshot) return undefined
    const file = await getFile(join(this.context.root, snapshot.domainedPath))
    if (!file) return undefined
    if (!isSnapshotValid(file, snapshot)) {
      this.context.db
        .deleteFrom('snapshots')
        .where('domainedPath', '=', snapshot.domainedPath)
        .execute()
      return undefined
    }
    return file
  }

  getSnapshotPath(snapshot: ResourceSnapshotTable) {
    return join(this.context.root, snapshot.domainedPath)
  }

  async getSnapshotsByDomainedPath(domainedPath: string[]): Promise<ResourceSnapshotTable[]> {
    return this.context.db
      .selectFrom('snapshots')
      .selectAll()
      .where('snapshots.domainedPath', 'in', domainedPath)
      .execute()
  }

  async getSnapshotsUnderDomainedPath(domainedPath: string): Promise<ResourceSnapshotTable[]> {
    return this.context.db
      .selectFrom('snapshots')
      .selectAll()
      .where('snapshots.domainedPath', 'like', `${domainedPath}/%`)
      .execute()
  }

  async getSnapshotByDomainedPath(
    domainedPath: string,
  ): Promise<ResourceSnapshotTable | undefined> {
    return this.getSnapshotsByDomainedPath([domainedPath]).then((v) => v[0])
  }

  getSnapshot(file: File): Promise<ResourceSnapshotTable>
  getSnapshot(file: string): Promise<ResourceSnapshotTable | undefined>
  async getSnapshot(file: File | string) {
    const resolved = typeof file === 'string' ? await getFile(file) : file
    if (resolved) {
      return takeSnapshot(resolved, this.context, true)
    }
  }

  async getResourcesByKeyword(keyword: string, prefix: string): Promise<Resource[]> {
    const matched = await this.context.db
      .selectFrom('snapshots')
      .fullJoin('resources', 'snapshots.sha1', 'resources.sha1')
      .leftJoin('icons', 'snapshots.sha1', 'icons.sha1')
      .selectAll()
      .where('domainedPath', 'is not', 'NULL')
      .where('domainedPath', 'like', `%${prefix}%`)
      .where((eb) =>
        eb.or([eb('name', 'like', `%${keyword}%`), eb('domainedPath', 'like', `%${keyword}%`)]),
      )
      .execute()

    const resources = await Promise.all(
      matched.map(async (match) => {
        if (!match.domainedPath || !match.ino || !match.sha1 || !match.mtime || !match.fileType)
          return undefined
        const snapshot = {
          domainedPath: match.domainedPath,
          ino: match.ino,
          sha1: match.sha1,
          mtime: match.mtime,
          fileType: match.fileType,
        }
        const file = await this.validateSnapshotFile(snapshot)
        if (!file) return undefined
        return generateResourceV3(file, snapshot, match as ResourceMetadata)
      }),
    )
    return resources.filter((v): v is Resource => !!v)
  }

  async getMetadataByHashes(
    sha1: string[],
  ): Promise<Array<(ResourceMetadata & { sha1: string }) | undefined>> {
    const metadata = await this.context.db
      .selectFrom('resources')
      .selectAll()
      .where('sha1', 'in', sha1)
      .execute()
    return metadata ? metadata.map((m) => ({ ...pickMetadata(m), sha1: m.sha1 })) : []
  }

  async getMetadataByHash(sha1: string): Promise<ResourceMetadata | undefined> {
    return this.getMetadataByHashes([sha1]).then((v) => v[0])
  }

  watch(options: Omit<WatchResourceDirectoryOptions, 'context' | 'onDispose'>) {
    const dir = options.directory
    const result = watchResourcesDirectory({
      ...options,
      onDispose: () => {
        delete this.#watched[dir]
      },
      context: this.context,
    })
    this.#watched[dir] = result
    return result
  }

  getWatched(directory: string) {
    return this.#watched[directory]
  }

  updateMetadata(
    payloads: [UpdateResourcePayload, UpdateResourcePayload],
  ): Promise<[string, string]>
  updateMetadata(payloads: [UpdateResourcePayload]): Promise<[string]>
  updateMetadata(payloads: UpdateResourcePayload[]): Promise<string[]>
  async updateMetadata(payloads: UpdateResourcePayload[]): Promise<string[]> {
    if (payloads.length === 0) return []
    for (const resource of payloads) {
      if (!resource.hash) {
        this.context.event.emit(
          'resourceUpdateMetadataError',
          resource,
          new AnyError('UpdateMetadataError', 'No hash provided'),
        )
        continue
      }
      await upsertMetadata(
        resource.hash,
        this.context,
        resource.metadata,
        resource.uris,
        resource.icons,
        resource.metadata?.name,
      )
    }

    this.context.event.emit('resourceUpdate', payloads)

    return []
  }
}
