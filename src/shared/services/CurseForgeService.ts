import { AddonInfo, File, GetFeaturedAddonOptions, SearchOptions } from '@xmcl/curseforge'
import { PersistedResource } from '../entities/resource'
import { ServiceKey } from './Service'
import { ProjectType } from '/@shared/entities/curseforge'
export interface InstallFileOptions {
  /**
   * The curseforge file
   */
  file: File
  projectId: number
  type: ProjectType
}
/**
 * A stateless service to request curseforge website.
 * The launcher backend will cache the curseforge data neither in memory or in disk.
 */
export interface CurseForgeService {
  loadCategories(): Promise<void>
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
   * @param projectId The curseforge project id
   */
  fetchProjectFiles(projectId: number): Promise<File[]>
  /**
   * Search curseforge projects by search options
   * @param searchOptions The search options
   */
  searchProjects(searchOptions: SearchOptions): Promise<AddonInfo[]>
  /**
   * Fetch featured projects
   * @param getOptions The get feature options
   */
  fetchFeaturedProjects(getOptions: GetFeaturedAddonOptions): Promise<AddonInfo[]>
  /**
   * Install a curseforge file to local storage
   * @param options The install file options
   */
  installFile(options: InstallFileOptions): Promise<PersistedResource<unknown>>
}

export const CurseForgeServiceKey: ServiceKey<CurseForgeService> = 'CurseForgeService'
