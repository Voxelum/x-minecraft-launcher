import type { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { Persisted, Resource } from '../entities/resource'
import { ServiceKey, StatefulService } from './Service'

export interface InstallProjectVersionOptions {
  version: ProjectVersion

  project?: Project
  /**
   * Ignore the dependencies of the version.
   *
   * This option will be ignore if this is a modpack.
   *
   * @default false
   */
  ignoreDependencies?: boolean
  /**
   * The instance to install to.
   *
   * - If this is a mod, it will enable it.
   * - If this is a modpack, this option will be ignored.
   */
  instancePath?: string
}

export class ModrinthState {
  downloading = [] as { url: string; taskId: string }[]

  modrinthDownloadFileStart({ url, taskId }: { url: string; taskId: string }) {
    this.downloading.push({ url, taskId })
  }

  modrinthDownloadFileEnd(url: string) {
    this.downloading = this.downloading.filter((f) => f.url !== url)
  }
}

export interface InstallModrinthVersionResult {
  version: ProjectVersion
  resources: Resource[]
  dependencies: InstallModrinthVersionResult[]
}

export interface ModrinthService extends StatefulService<ModrinthState> {
  searchProjects(options: SearchProjectOptions): Promise<SearchResult>

  getProject(projectId: string): Promise<Project>

  getProjectVersions(projectId: string): Promise<ProjectVersion[]>

  getProjectVersion(versionId: string): Promise<ProjectVersion>

  getLatestProjectVersion(projectId: string): Promise<ProjectVersion>

  getTags(): Promise<{ licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }>

  installVersion(options: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult>
}

export const ModrinthServiceKey: ServiceKey<ModrinthService> = 'ModrinthService'
