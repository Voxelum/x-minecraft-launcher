import type { ProjectVersion } from '@xmcl/modrinth'
import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'

export interface InstallProjectVersionOptions {
  /**
   * The version to install
   */
  version: ProjectVersion
  /**
   * The icon of the version
   */
  icon?: string
  /**
   * The instance to install to.
   *
   * - If this is a mod, it will enable it.
   * - If this is a modpack, this option will be ignored.
   */
  instancePath?: string
}

export interface InstallModrinthVersionResult {
  version: ProjectVersion
  resources: Resource[]
}

export interface ModrinthService {
  /**
   * Install the version into the launcher
   */
  installVersion(options: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult>
}

export const ModrinthServiceKey: ServiceKey<ModrinthService> = 'ModrinthService'
