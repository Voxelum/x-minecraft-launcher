import type { File, FileModLoaderType } from '@xmcl/curseforge'
import { ProjectType } from '../entities/curseforge'
import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'
export interface InstallFileOptions {
  /**
   * The curseforge file
   */
  file: File
  /**
   * The icon of the file
   */
  icon?: string
  /**
   * The project type.
   */
  type: ProjectType
  /**
   * Install this to the specific instance
   */
  instancePath?: string

  noPersist?: boolean
}

export interface GetModFilesOptions {
  modId: number
  gameVersion?: string
  modLoaderType?: FileModLoaderType
  /**
   * Filter only files that are tagged with versions of the given gameVersionTypeId
   */
  gameVersionTypeId?: number
  index?: number
  pageSize?: number
}

export interface GetModFileOptions {
  modId: number
  fileId: number
}

export interface InstallFileResult {
  /**
   * The file just installed
   */
  file: File
  /**
   * All installed resource corresponding to the file
   */
  resource: Resource
}

/**
 * A stateless service to request curseforge website.
 * The launcher backend will cache the curseforge data neither in memory or in disk.
 */
export interface CurseForgeService {
  /**
   * Install a curseforge file to local storage.
   *
   * If this file has dependencies, it will install all the dependencies of this file.
   * @param options The install file options
   */
  installFile(options: InstallFileOptions): Promise<InstallFileResult>
}

export function getInstallFileLockKey(options: InstallFileOptions): string {
  return options.file.id + '-' + options.instancePath
}

export const CurseForgeServiceKey: ServiceKey<CurseForgeService> = 'CurseForgeService'
