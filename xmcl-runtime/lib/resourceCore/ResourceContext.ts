import { ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { AbstractLevel, AbstractSublevel } from 'abstract-level'
import { ClassicLevel } from 'classic-level'
import { EventEmitter } from 'stream'
import { ImageStorage } from '../util/imageStore'
import { Logger } from '../util/log'
import { ParseResourceArgs, ParseResourceResult } from './resourceParsers'

export interface IResourceData extends ResourceMetadata {
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

export interface ResourceEntry {
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

export interface ResourceEntryCache extends ResourceEntry {
  /**
   * The basename of the file including the extension
   */
  fileName: string
  domain: ResourceDomain
}

export interface ResourceEntryPath extends ResourceEntry {
  path: string
}

/**
 * The total snapshot database for file cache
 */
export type ResourceSnapshotDatabase = AbstractLevel<Buffer, string, ResourceEntryCache>
/**
 * The domains like `!mods!` or `!resourcepacks!` prefixed sub-level of `ResourceSnapshotDatabase`
 */
export type ResourceFileNameSnapshotDatabase = AbstractSublevel<ResourceSnapshotDatabase, Buffer, string, ResourceEntryCache>
/**
 * The `!sha1!` prefixed sub-level of `ResourceSnapshotDatabase`
 */
export type ResourceSha1SnapshotDatabase = AbstractSublevel<ResourceSnapshotDatabase, Buffer, string, ResourceEntryCache>
/**
 * The `!ino!` prefixed sub-level of `ResourceSnapshotDatabase`
 */
export type ResourceInoSnapshotDatabase = AbstractSublevel<ResourceSnapshotDatabase, Buffer, string, ResourceEntryCache>
/**
 * The uri to sha1 database
 */
export type ResourceUriDatabase = AbstractLevel<Buffer, string, string>
/**
 * The sha1 to resource metadata database
 */
export type ResourceMetaDatabase = AbstractLevel<Buffer, string, IResourceData>

export interface ResourceContext {
  readonly level: ClassicLevel
  /**
   * The snapshot of the domain
   */
  readonly snapshot: ResourceSnapshotDatabase
  readonly fileNameSnapshots: Record<ResourceDomain, ResourceFileNameSnapshotDatabase>
  readonly inoSnapshot: ResourceInoSnapshotDatabase
  readonly sha1Snapshot: ResourceSha1SnapshotDatabase
  /**
   * The metadata database
   */
  readonly metadata: ResourceMetaDatabase
  readonly uri: ResourceUriDatabase

  readonly image: ImageStorage

  readonly eventBus: EventEmitter

  readonly hash: (file: string, size: number) => Promise<string>
  readonly hashAndFileType: (file: string, size: number) => Promise<[string, string]>
  readonly parse: (resource: ParseResourceArgs) => Promise<ParseResourceResult>

  readonly logger: Logger
}
