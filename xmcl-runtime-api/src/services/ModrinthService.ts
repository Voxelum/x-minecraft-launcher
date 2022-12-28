import type { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult, TeamMember } from '@xmcl/modrinth'
import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'

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

export interface InstallModrinthVersionResult {
  version: ProjectVersion
  resources: Resource[]
  dependencies: InstallModrinthVersionResult[]
}

export interface ModrinthService {
  searchProjects(options: SearchProjectOptions): Promise<SearchResult>

  getProject(projectId: string): Promise<Project>

  getProjectVersions(options: { projectId: string; featured?: boolean }): Promise<ProjectVersion[]>

  getProjectVersion(versionId: string): Promise<ProjectVersion>

  getLatestProjectVersion(hash: string): Promise<ProjectVersion>

  getProjectTeamMembers(projectId: string): Promise<TeamMember[]>

  getTags(): Promise<{ licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }>

  installVersion(options: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult>
}

export const ModrinthServiceKey: ServiceKey<ModrinthService> = 'ModrinthService'
