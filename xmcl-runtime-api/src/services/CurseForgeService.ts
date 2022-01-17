import type { AddonInfo, Category, File, GetFeaturedAddonOptions, SearchOptions } from '@xmcl/curseforge'
import { PersistedResource } from '../entities/resource'
import { ResourceState } from './ResourceService'
import { ServiceKey, ServiceTemplate, StatefulService } from './Service'
import { ProjectType } from '../entities/curseforge'
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
  categories = [] as Category[]
  categoriesTimestamp = ''

  constructor(private resourceState: ResourceState) {
  }

  get isFileInstalled() {
    return (file: { id: number; href: string }) => {
      const find = (m: PersistedResource) => {
        if ('curseforge' in m && typeof m.curseforge === 'object') {
          const s = m.curseforge
          if (s.fileId === file.id) return true
        }
        return false
      }
      if (this.resourceState.mods.find(find)) return true
      if (this.resourceState.resourcepacks.find(find)) return true
      if (this.resourceState.modpacks.find(find)) return true
      if (this.resourceState.saves.find(find)) return true

      return false
    }
  }

  get findFileInstalled() {
    return (file: { id: number; href: string }) => {
      const find = (m: PersistedResource) => {
        const source = m
        if ('curseforge' in source && typeof source.curseforge === 'object') {
          const s = source.curseforge
          if (s.fileId === file.id) return true
        }
        return false
      }
      let result
      /* eslint-disable no-cond-assign */
      if (result = this.resourceState.mods.find(find)) return result
      if (result = this.resourceState.resourcepacks.find(find)) return result
      if (result = this.resourceState.modpacks.find(find)) return result
      if (result = this.resourceState.saves.find(find)) return result
      /* eslint-enable no-cond-assign */

      return undefined
    }
  }

  curseforgeDownloadFileStart({ fileId, taskId }: { fileId: number; taskId: string }) {
    this.downloading.push({ fileId, taskId })
  }

  curseforgeDownloadFileEnd(fileId: number) {
    this.downloading = this.downloading.filter((f) => f.fileId !== fileId)
  }

  curseforgeCategories({ categories, timestamp }: { categories: Category[]; timestamp: string }) {
    this.categories = categories
    this.categoriesTimestamp = timestamp
  }
}

/**
 * A stateless service to request curseforge website.
 * The launcher backend will cache the curseforge data neither in memory or in disk.
 */
export interface CurseForgeService extends StatefulService<CurseforgeState> {
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
export const CurseForgeServiceMethods: ServiceTemplate<CurseForgeService> = {
  fetchFeaturedProjects: undefined,
  fetchProject: undefined,
  fetchProjectDescription: undefined,
  fetchProjectFiles: undefined,
  loadCategories: undefined,
  searchProjects: undefined,
  installFile: undefined,
  state: undefined,
}
