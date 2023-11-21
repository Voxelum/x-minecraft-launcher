import { ResourceMetadata } from '@xmcl/runtime-api'

export interface ResourceTable extends ResourceMetadata {
  sha1: string
  sha256?: string
  name: string
}

export interface ResourceTagTable {
  sha1: string
  tag: string
}

export interface ResourceUriTable {
  sha1: string
  uri: string
}

export interface ResourceIconTable {
  sha1: string
  icon: string
}

export interface ResourceSnapshotTable extends ResourceEntry {
  /**
   * The ${domain}/${fileName} path
   * @primary
   */
  domainedPath: string
}

export interface Database {
  resources: ResourceTable
  tags: ResourceTagTable
  uris: ResourceUriTable
  icons: ResourceIconTable
  snapshots: ResourceSnapshotTable
}

export interface ResourceDecoratedMetadata extends ResourceMetadata {
  name: string
  icons?: string[]
  uris?: string[]
  tags?: string[]
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

export interface ResourceEntryPath extends ResourceEntry {
  path: string
}
