import type { LabyModManifest } from '@xmcl/installer'
import { Exception } from '../entities/exception'
import type { ExceptionBase } from '../entities/exception'
import type { FabricArtifactVersion, ForgeVersion, MinecraftVersions, OptifineVersion } from '../entities/version'
import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'

export interface FabricVersionsResult {
  gameVersions: string[]
  loaderVersions: FabricArtifactVersion[]
}

export interface VersionMetadataFetchFailedException extends ExceptionBase {
  type: 'versionMetadataFetchFailed'
  cachePath: string
  sources: string[]
}

export type VersionMetadataExceptions = VersionMetadataFetchFailedException

export class VersionMetadataException extends Exception<VersionMetadataExceptions> { }

/**
 * Events fired when a background stale-while-revalidate cycle for a
 * provider produces fresh data. Subscribe from the renderer to update
 * displayed lists without a manual refresh. A successful `force` refresh
 * also emits the event.
 */
export interface VersionMetadataServiceEventMap {
  'minecraftVersions': MinecraftVersions
  'forgeVersions': { minecraft: string; versions: ForgeVersion[] }
  'neoForgedVersions': { minecraft: string; versions: string[] }
  'fabricVersions': FabricVersionsResult
  'quiltVersions': FabricVersionsResult
  'optifineVersions': OptifineVersion[]
  'labyModManifest': LabyModManifest
}

export interface VersionMetadataService extends GenericEventEmitter<VersionMetadataServiceEventMap> {
  getLatestMinecraftRelease(): Promise<string>

  setLatestMinecraft(release: string, snapshot: string): void

  getMinecraftVersions(force?: boolean): Promise<MinecraftVersions>

  getForgeVersions(minecraft: string, force?: boolean): Promise<ForgeVersion[]>

  getNeoForgedVersions(minecraft: string, force?: boolean): Promise<string[]>

  getFabricVersions(force?: boolean): Promise<FabricVersionsResult>

  getQuiltVersions(force?: boolean): Promise<FabricVersionsResult>

  getOptifineVersions(force?: boolean): Promise<OptifineVersion[]>

  getLabyModManifest(force?: boolean): Promise<LabyModManifest>
}

export const VersionMetadataServiceKey: ServiceKey<VersionMetadataService> = 'VersionMetadataService'
