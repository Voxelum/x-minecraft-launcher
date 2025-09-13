import { ResourceDomain, ResourceMetadata } from '@xmcl/resource'
import { InstallMarketOptions, } from '@xmcl/runtime-api'
import { InjectionKey } from '~/app'

export const kMarketProvider: InjectionKey<MarketProvider> = Symbol('MarketProvider')

export type InstallMarketDirectoryOptions = InstallMarketOptions & {
  /**
   * The directory to intall the file
   */
  directory: string
}

export type InstallMarketInstanceOptions = InstallMarketOptions & {
  /**
   * The instance path to install the file
   */
  instancePath: string
  /**
   * The domain of the resource
   */
  domain: ResourceDomain
}

export type InstallResult = {
  path: string
  uris: string[]
  metadata: ResourceMetadata
}

export interface MarketProvider {
  /**
   * Install a modrinth or curseforge file to the folder.
   */
  installFile(options: InstallMarketDirectoryOptions): Promise<InstallResult[]>
  /**
   * Use instance install mechanism to install the file.
   */
  installInstanceFile(options: InstallMarketInstanceOptions): Promise<InstallResult[]>
}
