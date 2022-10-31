import type { Mod, File, FileModLoaderType, Pagination, ModCategory, SearchOptions, FileRelationType } from '@xmcl/curseforge'
import { ProjectType } from '../entities/curseforge'
import { Persisted, Resource } from '../entities/resource'
import { ServiceKey, StatefulService } from './Service'
export interface InstallFileOptions {
  /**
   * The curseforge file
   */
  file: File
  projectId: number
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

export class CurseforgeState {
  downloading = [] as { fileId: number }[]

  curseforgeDownloadFileStart({ fileId }: { fileId: number }) {
    this.downloading.push({ fileId })
  }

  curseforgeDownloadFileEnd(fileId: number) {
    this.downloading = this.downloading.filter((f) => f.fileId !== fileId)
  }
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

export interface InstallFileResult {
  mod: Mod
  file: File
  /**
   * All installed resource corresponding to the file
   */
  resource: Persisted<Resource>
  /**
   * All dependencies of this resource
   */
  dependencies: InstallFileResult[]
}

/**
 * A stateless service to request curseforge website.
 * The launcher backend will cache the curseforge data neither in memory or in disk.
 */
export interface CurseForgeService extends StatefulService<CurseforgeState> {
  fetchCategories(): Promise<ModCategory[]>
  /**
   * Fetch a curseforge project info
   * @param projectId The curseforge project id
   */
  fetchProject(projectId: number): Promise<Mod>
  /**
   * Fetch a curseforge project description string
   * @param projectId The curseforge project id
   */
  fetchProjectDescription(projectId: number): Promise<string>
  /**
   * Fetch all curseforge project files
   * @param options The curseforge project id
   */
  fetchProjectFiles(options: GetModFilesOptions): Promise<{ data: File[]; pagination: Pagination }>

  fetchModFiles(ids: number[]): Promise<File[]>

  fetchMods(modIds: number[]): Promise<Mod[]>
  /**
   * Search curseforge projects by search options
   * @param searchOptions The search options
   */
  searchProjects(searchOptions: SearchOptions): Promise<{ data: Mod[]; pagination: Pagination }>

  resolveFileDependencies(file: File): Promise<[File, FileRelationType][]>
  /**
   * Install a curseforge file to local storage.
   *
   * If this file has dependencies, it will install all the dependencies of this file.
   * @param options The install file options
   */
  installFile(options: InstallFileOptions): Promise<InstallFileResult>
}

export const CurseForgeServiceKey: ServiceKey<CurseForgeService> = 'CurseForgeService'
