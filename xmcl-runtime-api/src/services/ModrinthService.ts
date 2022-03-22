import type { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { AnyPersistedResource } from '../entities/resource'
import { ServiceKey, StatefulService } from './Service'

export interface InstallProjectVersionOptions {
  version: ProjectVersion
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

export interface ModrinthService extends StatefulService<ModrinthState> {
  searchProjects(options: SearchProjectOptions): Promise<SearchResult>

  getProject(projectId: string): Promise<Project>

  getProjectVersions(projectId: string): Promise<ProjectVersion[]>

  getProjectVersion(versionId: string): Promise<ProjectVersion>

  getTags(): Promise<{ licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }>

  installVersion(options: InstallProjectVersionOptions): Promise<AnyPersistedResource>
}

export const ModrinthServiceKey: ServiceKey<ModrinthService> = 'ModrinthService'
