import { AddonInfo, File, GetFeaturedAddonOptions, SearchOptions } from '@xmcl/curseforge'
import { PersistedResource } from '../entities/resource'
import { ServiceKey } from './Service'
import { ProjectType } from '/@shared/entities/curseforge'
export interface InstallFileOptions {
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
  fetchProject(projectId: number): Promise<AddonInfo>
  fetchProjectDescription(projectId: number): Promise<string>
  fetchProjectFiles(projectId: number): Promise<File[]>
  searchProjects(searchOptions: SearchOptions): Promise<AddonInfo[]>
  fetchFeaturedProjects(getOptions: GetFeaturedAddonOptions): Promise<AddonInfo[]>
  installFile({ file, type, projectId }: InstallFileOptions): Promise<PersistedResource<unknown>>
}

export const CurseForgeServiceKey: ServiceKey<CurseForgeService> = 'CurseForgeService'
