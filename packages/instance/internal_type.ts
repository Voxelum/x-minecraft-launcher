import { ResourceLike } from './files_discovery'
/**
 * Logger interface abstraction
 */
export interface Logger {
  warn(message: string | Error, e?: any): void
  log(message: string): void
}

/**
 * Worker interface for computing checksums
 */
export interface ChecksumWorker {
  checksum(filePath: string, algorithm: string): Promise<string>
}

/**
 * Resource manager interface abstraction
 */
export interface ResourceManager {
  getSnapshotsByIno(inos: number[]): Promise<Array<{ ino: number; sha1: string }>>
  getMetadataByHashes(hashes: string[]): Promise<Array<ResourceLike | undefined>>
  getUrisByHash(hashes: string[]): Promise<Array<{ sha1: string; uri: string }>>
}

/**
 * Interface for version metadata provider
 */
export interface VersionMetadataProvider {
  (): string
}
