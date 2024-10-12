/* eslint-disable no-dupe-class-members */
import { File, ResourceState, UpdateResourcePayload, ResourceDomain, ResourceMetadata, Resource } from '@xmcl/runtime-api'
import { join } from 'path'
import { ResourceContext } from './core/ResourceContext'
import { generateResourceV3, pickMetadata } from './core/generateResource'
import { ResourceSnapshotTable, ResourceUriTable } from './core/schema'
import { watchResourcesDirectory, watchResourceSecondaryDirectory } from './core/watchResourcesDirectory'
import { isSnapshotValid, takeSnapshot } from './core/snapshot'
import { getFile } from './core/files'
import { ResourceWorkerQueuePayload } from './core/ResourceWorkerQueuePayload'
import { isNonnull } from '~/util/object'
import { upsertMetadata } from './core/upsertMetadata'
import { Inject, InjectionKey } from '~/app'

export interface ResourceParsedEvent {
  file: File
  record: ResourceSnapshotTable
  metadata: ResourceMetadata & {
    icons?: string[] | undefined
  }
  uris: string[]
  icons: string[]
  cacheHit: boolean
  dirty: boolean
}

export const kResourceContext: InjectionKey<ResourceContext> = Symbol('resourceContext')

export class ResourceManager {
  #watched: Record<string, { enqueue: (job: ResourceWorkerQueuePayload) => void }> = {}
  #watchedSecondary: Record<string, string> = {}

  constructor(
    @Inject(kResourceContext) readonly context: ResourceContext,
  ) { }

  async isReady() {
    return this.context.isDatabaseOpened()
  }

  async getHashByUri(uri: string): Promise<string | undefined> {
    return this.getHashesByUris([uri]).then(v => v[0])
  }

  async getHashesByUris(uri: string[]): Promise<string[]> {
    const uris = await this.context.db.selectFrom('uris')
      .where('uris.uri', 'in', uri).select('uris.sha1').execute()
    return uris ? uris.map((v) => v.sha1) : []
  }

  async getUrisByHash(sha1: string[]): Promise<ResourceUriTable[]> {
    const uris = await this.context.db.selectFrom('uris')
      .where('uris.sha1', 'in', sha1)
      .selectAll()
      .execute()
    return uris || []
  }

  async getUriByHash(sha1: string): Promise<string[]> {
    const uris = await this.context.db.selectFrom('uris')
      .where('uris.sha1', '=', sha1).select('uris.uri').execute()
    return uris ? uris.map((v) => v.uri) : []
  }

  async getSnapshotsByIon(inos: number[]): Promise<ResourceSnapshotTable[]> {
    const items = await this.context.db.selectFrom('snapshots')
      .selectAll()
      .where('snapshots.ino', 'in', inos)
      .execute()
    return items || []
  }

  async getSnapshotByIno(ino: number): Promise<ResourceSnapshotTable | undefined> {
    return this.getSnapshotsByIon([ino]).then(v => v[0])
  }

  async getSnapshotsByHash(sha1: string[]): Promise<ResourceSnapshotTable[]> {
    const items = await this.context.db.selectFrom('snapshots')
      .selectAll()
      .where('snapshots.sha1', 'in', sha1)
      .execute()
    return items || []
  }

  async getSnapshotByHash(sha1: string): Promise<ResourceSnapshotTable | undefined> {
    return this.getSnapshotsByHash([sha1]).then(v => v[0])
  }

  async validateSnapshot(snapshot: ResourceSnapshotTable): Promise<boolean> {
    return await this.validateSnapshotFile(snapshot) !== undefined
  }

  async validateSnapshotFile(snapshot: ResourceSnapshotTable): Promise<File | undefined> {
    const file = await getFile(join(this.context.root, snapshot.domainedPath))
    if (!file) return file
    if (!isSnapshotValid(file, snapshot)) {
      this.context.db.deleteFrom('snapshots')
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
    return this.context.db.selectFrom('snapshots')
      .selectAll()
      .where('snapshots.domainedPath', 'in', domainedPath)
      .execute()
  }

  async getSnapshotsUnderDomainedPath(domainedPath: string): Promise<ResourceSnapshotTable[]> {
    return this.context.db.selectFrom('snapshots')
      .selectAll()
      .where('snapshots.domainedPath', 'like', `${domainedPath}/%`)
      .execute()
  }

  async getSnapshotByDomainedPath(domainedPath: string): Promise<ResourceSnapshotTable | undefined> {
    return this.getSnapshotsByDomainedPath([domainedPath]).then(v => v[0])
  }

  async getSnapshot(file: File) {
    return takeSnapshot(file, this.context, true)
  }

  async getResourcesByKeyword(keyword: string, prefix: string): Promise<Resource[]> {
    const matched = await this.context.db.selectFrom('snapshots')
      .fullJoin('resources', 'snapshots.sha1', 'resources.sha1')
      .leftJoin('icons', 'snapshots.sha1', 'icons.sha1')
      .selectAll()
      .where('domainedPath', 'is not', 'NULL')
      .where('domainedPath', 'like', `%${prefix}%`)
      .where(eb => eb.or([
        eb('name', 'like', `%${keyword}%`),
        eb('domainedPath', 'like', `%${keyword}%`),
      ]))
      .execute()

    const resources = await Promise.all(matched.map(async (match) => {
      if (!match.domainedPath || !match.ino || !match.sha1 || !match.mtime || !match.fileType) return undefined
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
    }))
    return resources.filter(isNonnull)
  }

  async getMetadataByHashes(sha1: string[]): Promise<Array<ResourceMetadata & { sha1: string } | undefined>> {
    const metadata = await this.context.db.selectFrom('resources')
      .selectAll()
      .where('sha1', 'in', sha1).execute()
    return metadata ? metadata.map(m => ({ ...pickMetadata(m), sha1: m.sha1 })) : []
  }

  async getMetadataByHash(sha1: string): Promise<ResourceMetadata | undefined> {
    return this.getMetadataByHashes([sha1]).then(v => v[0])
  }

  watch(directory: string, domain: ResourceDomain, processUpdate: (func: () => Promise<void>) => Promise<void>, state = new ResourceState()) {
    const result = watchResourcesDirectory(directory, domain, this.context, processUpdate, () => {
      delete this.#watched[directory]
    }, state)
    this.#watched[directory] = result
    return result
  }

  getWatched(directory: string) {
    if (this.#watchedSecondary[directory]) {
      return this.#watched[this.#watchedSecondary[directory]]
    }
    return this.#watched[directory]
  }

  watchSecondary(directory: string, domain: ResourceDomain) {
    const primary = join(this.context.root, domain)
    const result = watchResourceSecondaryDirectory(join(directory, domain), primary, this.context, () => {
      delete this.#watchedSecondary[directory]
    })
    this.#watchedSecondary[directory] = primary
    return result
  }

  updateMetadata(payloads: [UpdateResourcePayload, UpdateResourcePayload]): Promise<[string, string]>
  updateMetadata(payloads: [UpdateResourcePayload]): Promise<[string]>
  updateMetadata(payloads: UpdateResourcePayload[]): Promise<string[]>
  async updateMetadata(payloads: UpdateResourcePayload[]): Promise<string[]> {
    if (payloads.length === 0) return []
    for (const resource of payloads) {
      await upsertMetadata(resource.hash, this.context, resource.metadata, resource.uris, resource.icons, resource.metadata?.name)
    }

    this.context.eventBus.emit('resourceUpdate', payloads)

    return []
  }
}
