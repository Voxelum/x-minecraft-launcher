import { ResourceMetadata } from './ResourceMetadata'

export interface ResourceTable extends ResourceMetadata {
  sha1: string
  sha256?: string
  name?: string
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

export interface ResourceSnapshotTable {
  /**
   * The ${domain}/${fileName} path
   * @primary
   */
  domainedPath: string
  /**
   * The inode number
   */
  ino: number
  /**
   * The file type
   */
  fileType: string
  /**
   * The sha1 string
   */
  sha1: string
  /**
   * The mtime of the file
   */
  mtime: number
  /**
   * The last parser error code for this snapshot, if any. Set when the
   * resource worker fails to parse this file with a known broken-file
   * signature (e.g. `InvalidZipFileError`). When present, revalidate
   * skips re-parsing this snapshot — the file is treated as "scanned
   * and known broken" until its mtime/ino changes (i.e. the user fixes
   * or replaces it). This avoids spamming the UI with the same parse
   * error every time the renderer reconnects. See issue #1453.
   */
  parseError?: string | null
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

export interface ResourceEntry extends File {
  fileType: string
  /**
   * The sha1 string
   */
  sha1: string
}

export interface ResourceEntryPath extends ResourceEntry {
  path: string
}
