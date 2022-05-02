/* eslint-disable @typescript-eslint/no-redeclare */
import { MinecraftJarIssue, ResolvedVersion, AssetIndexIssue, LibraryIssue, AssetIssue } from '@xmcl/core'
import { RuntimeVersions } from '../entities/instance.schema'
import { IssueKey } from '../entities/issue'
import { GenericEventEmitter } from '../events'
import { Exception } from '../entities/exception'
import { ServiceKey, StatefulService } from './Service'
import { InstallProfile } from '@xmcl/installer'
import { LocalVersionHeader } from './VersionService'

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

interface EventMap {
  error: InstanceVersionException
}

interface VersionIssue extends RuntimeVersions {
  version: string
}

interface VersionJarIssue extends RuntimeVersions, MinecraftJarIssue {
}

interface VersionJsonIssue extends RuntimeVersions {
  version: string
}

interface InstallProfileIssue {
  version: string
  minecraft: string
  installProfile: InstallProfile
}

export const VersionIssueKey: IssueKey<VersionIssue> = 'version'
export const VersionJsonIssueKey: IssueKey<VersionJsonIssue> = 'versionJson'
export const VersionJarIssueKey: IssueKey<VersionJarIssue> = 'versionJar'
export const AssetIndexIssueKey: IssueKey<AssetIndexIssue & RuntimeVersions> = 'assetIndex'
export const LibrariesIssueKey: IssueKey<{ version: string; libraries: LibraryIssue[] }> = 'library'
export const AssetsIssueKey: IssueKey<{ version: string; assets: AssetIssue[] }> = 'asset'
export const InstallProfileIssueKey: IssueKey<InstallProfileIssue> = 'badInstall'

export interface InstanceVersionService extends StatefulService<InstanceVersionState>, GenericEventEmitter<EventMap> {
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
