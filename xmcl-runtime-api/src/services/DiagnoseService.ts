/* eslint-disable @typescript-eslint/no-redeclare */
import { AssetIndexIssue, AssetIssue, LibraryIssue, MinecraftJarIssue, ResolvedVersion } from '@xmcl/core'
import { InstallProfileIssueReport } from '@xmcl/installer'
import { ServiceKey } from './Service'

export interface DiagnoseService {
  diagnoseLibraries(currentVersion: ResolvedVersion): Promise<LibraryIssue[]>
  diagnoseAssetIndex(currentVersion: ResolvedVersion): Promise<AssetIndexIssue | undefined>
  diagnoseAssets(currentVersion: ResolvedVersion, strict?: boolean): Promise<AssetIssue[]>
  diagnoseJar(currentVersion: ResolvedVersion, side?: 'client' | 'server'): Promise<MinecraftJarIssue | undefined>
  diagnoseProfile(version: string, side?: 'client' | 'server', path?: string): Promise<InstallProfileIssueReport | undefined>
}

export const DiagnoseServiceKey: ServiceKey<DiagnoseService> = 'DiagnoseService'
