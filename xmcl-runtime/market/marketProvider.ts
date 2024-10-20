import { File, InstallMarketOptions, Resource, ResourceMetadata } from '@xmcl/runtime-api'
import { InjectionKey } from '~/app'
import { ResourceSnapshotTable } from '~/resource/core/schema'

export const kMarketProvider: InjectionKey<MarketProvider> = Symbol('MarketProvider')

export type InstallMarketDirectoryOptions = InstallMarketOptions & {
  /**
   * The directory to intall the file
   */
  directory: string
}

export type InstallResult = {
  path: string
  uris: string[]
  metadata: ResourceMetadata
  snapshot?: ResourceSnapshotTable
  file?: File
}

export interface MarketProvider {
  /**
   * Install a modrinth or curseforge file to the folder.
   */
  installFile(options: InstallMarketDirectoryOptions): Promise<InstallResult[]>
}
