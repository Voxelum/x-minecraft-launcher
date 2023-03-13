import type { File, FileModLoaderType, FileRelationType, Mod, ModCategory, Pagination, SearchOptions } from '@xmcl/curseforge'
import { ProjectType } from '../entities/curseforge'
import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'
export interface InstallFileOptions {
  /**
   * The curseforge file
   */
  file: File
  type: ProjectType
  /**
   * Install this to the specific instance
   */
  instancePath?: string
  /**
   * Should we ignore the dependencies
   *
   * @default false
   */
  ignoreDependencies?: boolean
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
  mod: Mod
  file: File
  /**
   * All installed resource corresponding to the file
   */
  resource: Resource
  /**
   * All dependencies of this resource
   */
  dependencies: InstallFileResult[]
}

/**
 * A stateless service to request curseforge website.
 * The launcher backend will cache the curseforge data neither in memory or in disk.
 */
export interface CurseForgeService {
  fetchCategories(): Promise<ModCategory[]>
  /**
   * Fetch a curseforge project info
   * @param modId The curseforge project id
   */
  getMod(modId: number): Promise<Mod>

  getLocaledMod(modId: number): Promise<Mod>
  /**
   * Fetch a curseforge project description string
   * @param modId The curseforge project id
   */
  getModDescription(modId: number): Promise<string>
  getLocaledModDescription(modId: number): Promise<string>
  /**
   * Fetch all curseforge project files
   * @param options The curseforge project id
   */
  getModFiles(options: GetModFilesOptions): Promise<{ data: File[]; pagination: Pagination }>
  getModFile(options: GetModFileOptions): Promise<File>
  /**
   * The mod files by files ids
   */
  getModFilesByIds(ids: number[]): Promise<File[]>
  /**
   * The mods by mod ids
   */
  getModsByIds(modIds: number[]): Promise<Mod[]>
  /**
   * Search curseforge projects by search options
   * @param searchOptions The search options
   */
  searchProjects(searchOptions: SearchOptions): Promise<{ data: Mod[]; pagination: Pagination }>

  resolveFileDependencies(file: File): Promise<[File, FileRelationType][]>

  getFileChangelog(file: Pick<File, 'modId' | 'id'>): Promise<string>
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
