import { File, InstallMarketOptions, Resource } from '@xmcl/runtime-api'
import { InjectionKey } from '~/app'
import { ResourceSnapshotTable } from '~/resource/core/schema'

export const kMarketProvider: InjectionKey<MarketProvider> = Symbol('MarketProvider')

export type InstallMarketDirectoryOptions = InstallMarketOptions & {
  /**
   * The directory to intall the file
   */
  directory: string
}

interface BaseInstallResult {
  path: string
  uris: string[]
  metadata: Record<string, any>
}

export type InstallResult = BaseInstallResult | (BaseInstallResult & {
  snapshot: ResourceSnapshotTable
  file: File
})

export interface MarketProvider {
  /**
   * Install a modrinth or curseforge file to the folder.
   */
  installFile(options: InstallMarketDirectoryOptions): Promise<InstallResult>
}
