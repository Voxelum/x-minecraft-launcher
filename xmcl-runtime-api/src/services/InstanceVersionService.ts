/* eslint-disable @typescript-eslint/no-redeclare */
import { AssetIndexIssue, AssetIssue, LibraryIssue, MinecraftJarIssue, ResolvedVersion } from '@xmcl/core'
import { InstallProfileIssueReport } from '@xmcl/installer'
import { Exception } from '../entities/exception'
import { LocalVersionHeader } from '../entities/version'
import { ServiceKey } from './Service'

export class InstanceVersionState {
  version: ResolvedVersion | undefined
  versionHeader: LocalVersionHeader | undefined

  instanceVersion(version: ResolvedVersion | undefined) {
    this.version = version
  }

  instanceVersionHeader(version: LocalVersionHeader | undefined) {
    this.versionHeader = version
  }
}

export interface InstanceVersionService {
  diagnoseLibraries(currentVersion: ResolvedVersion): Promise<LibraryIssue[]>
  diagnoseAssetIndex(currentVersion: ResolvedVersion): Promise<AssetIndexIssue | undefined>
  diagnoseAssets(currentVersion: ResolvedVersion, strict?: boolean): Promise<AssetIssue[]>
  diagnoseJar(currentVersion: ResolvedVersion): Promise<MinecraftJarIssue | undefined>
  diagnoseProfile(version: string): Promise<InstallProfileIssueReport | undefined>
}

export const InstanceVersionServiceKey: ServiceKey<InstanceVersionService> = 'InstanceVersionService'

export type InstanceVersionExceptions = {
  /**
   * - fixVersionNoVersionMetadata -> no minecraft version metadata.
   * - fixVersionNoForgeVersionMetadata -> no forge version metadata.
   */
  type: 'fixVersionNoVersionMetadata' | 'fixVersionNoForgeVersionMetadata'
  minecraft: string
  forge?: string
}

export class InstanceVersionException extends Exception<InstanceVersionExceptions> { }
