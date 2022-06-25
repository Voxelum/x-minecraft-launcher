import type { AddonInfo, Category, File, FileModLoaderType, GetFeaturedAddonOptions, Pagination, SearchOptions } from '@xmcl/curseforge'
import { ProjectType } from '../entities/curseforge'
import { PersistedResource } from '../entities/resource'
import { ServiceKey, StatefulService } from './Service'
export interface InstallFileOptions {
  /**
   * The curseforge file
   */
  file: File
  projectId: number
  type: ProjectType
}

export class CurseforgeState {
  downloading = [] as { fileId: number; taskId: string }[]

  curseforgeDownloadFileStart({ fileId, taskId }: { fileId: number; taskId: string }) {
    this.downloading.push({ fileId, taskId })
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

/**
 * A stateless service to request curseforge website.
 * The launcher backend will cache the curseforge data neither in memory or in disk.
 */
export interface CurseForgeService extends StatefulService<CurseforgeState> {
  fetchCategories(): Promise<Category[]>
  /**
   * Fetch a curseforge project info
   * @param projectId The curseforge project id
   */
  fetchProject(projectId: number): Promise<AddonInfo>
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
  /**
   * Search curseforge projects by search options
   * @param searchOptions The search options
   */
  searchProjects(searchOptions: SearchOptions): Promise<{ data: AddonInfo[]; pagination: Pagination }>
  /**
   * Install a curseforge file to local storage
   * @param options The install file options
   */
  installFile(options: InstallFileOptions): Promise<PersistedResource<unknown>>
}

export const CurseForgeServiceKey: ServiceKey<CurseForgeService> = 'CurseForgeService'
